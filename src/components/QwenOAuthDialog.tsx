import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IpcClient } from "@/ipc/ipc_client";
import { showError, showSuccess } from "@/lib/toast";
import { Loader2, KeyRound, ExternalLink } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

interface QwenOAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QwenOAuthDialog({ isOpen, onClose }: QwenOAuthDialogProps) {
  const [step, setStep] = useState<'device-code' | 'polling' | 'success' | 'error'>('device-code');
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { updateSettings } = useSettings();

  const startOAuthFlow = async () => {
    try {
      setIsLoading(true);
      setError('');

      const result = await IpcClient.getInstance().qwenOAuthDeviceCode();

      setDeviceCode(result.device_code);
      setUserCode(result.user_code);
      setVerificationUrl(result.verification_uri_complete);

      // Open the verification URL in browser
      await IpcClient.getInstance().openExternalUrl(result.verification_uri_complete);

      setStep('polling');

      // Start polling for token
      pollForToken(result.device_code, result.code_verifier, result.interval || 5);
    } catch (err) {
      console.error('Failed to start Qwen OAuth:', err);
      setError(err instanceof Error ? err.message : 'Failed to start authentication');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const pollForToken = async (deviceCode: string, codeVerifier: string, interval: number) => {
    try {
      const result = await IpcClient.getInstance().qwenOAuthToken({
        deviceCode,
        codeVerifier,
      });

      // Success! Store the tokens
      await updateSettings({
        qwenAccessToken: result.access_token,
        qwenRefreshToken: result.refresh_token || '',
        qwenTokenExpiry: Date.now() + (result.expires_in * 1000),
        qwenResourceUrl: result.resource_url || 'https://dashscope.aliyuncs.com/api/v1/',
      });

      setStep('success');
      showSuccess('Qwen authentication successful! Pro features are now enabled.');
    } catch (pollError: any) {
      if (pollError.error === 'authorization_pending') {
        // Still waiting for user to authorize, continue polling
        setTimeout(() => pollForToken(deviceCode, codeVerifier, interval), interval * 1000);
      } else if (pollError.error === 'slow_down') {
        // Slow down polling as requested
        setTimeout(() => pollForToken(deviceCode, codeVerifier, interval + 5), (interval + 5) * 1000);
      } else {
        // Real error
        console.error('Qwen OAuth polling failed:', pollError);
        setError(pollError.error_description || pollError.error || 'Authentication failed');
        setStep('error');
      }
    }
  };

  const handleClose = () => {
    setStep('device-code');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Get Qwen Token
          </DialogTitle>
          <DialogDescription>
            Authenticate with Qwen to enable Pro features with 2000 free requests per day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'device-code' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Click the button below to start the Qwen authentication process.
              </p>
              <Button onClick={startOAuthFlow} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Authentication...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Start Qwen Authentication
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'polling' && (
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Complete authentication in your browser</p>
                <p className="text-sm text-muted-foreground">
                  Your browser should have opened automatically. If not, visit:
                </p>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-xs break-all">{verificationUrl}</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter this code when prompted: <strong>{userCode}</strong>
                </p>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Waiting for authentication...</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <KeyRound className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-green-900 dark:text-green-100">Authentication Successful!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Qwen Pro features are now enabled with 2000 free requests per day.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
                <KeyRound className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-100">Authentication Failed</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error || 'An unexpected error occurred during authentication.'}
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={() => setStep('device-code')} variant="outline" className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleClose} variant="ghost" className="w-full">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
