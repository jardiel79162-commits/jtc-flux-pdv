import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, X, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Função para gerar som de beep
const playBeepSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1200; // Frequência do beep (Hz)
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (err) {
    console.error("Erro ao reproduzir som:", err);
  }
};

export const BarcodeScanner = ({ onScan, isOpen, onClose }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkCameraPermission();
    } else {
      stopScanner();
      setPermissionState("checking");
      setError(null);
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const checkCameraPermission = async () => {
    setPermissionState("checking");
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        setPermissionState(result.state as "prompt" | "granted" | "denied");
        
        if (result.state === "granted") {
          startScanner();
        }
      } else {
        setPermissionState("prompt");
      }
    } catch (err) {
      setPermissionState("prompt");
    }
  };

  const requestCameraAccess = async () => {
    setError(null);
    setPermissionState("checking");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState("granted");
      startScanner();
    } catch (err: any) {
      console.error("Erro ao solicitar permissão:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionState("denied");
        setError("Permissão da câmera negada. Acesse as configurações do navegador para permitir.");
      } else if (err.name === "NotFoundError") {
        setError("Nenhuma câmera encontrada no dispositivo.");
      } else {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }
  };

  const startScanner = async () => {
    try {
      setError(null);
      const scannerId = "barcode-scanner-container";
      
      if (scannerRef.current) {
        await stopScanner();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      scannerRef.current = new Html5Qrcode(scannerId);
      setIsScanning(true);

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Tocar som de beep ao ler código
          playBeepSound();
          onScan(decodedText);
          handleClose();
        },
        () => {
          // Ignore errors during scanning
        }
      );
    } catch (err: any) {
      console.error("Erro ao iniciar scanner:", err);
      if (err.name === "NotAllowedError") {
        setPermissionState("denied");
        setError("Permissão da câmera negada. Acesse as configurações do navegador para permitir.");
      } else {
        setError("Não foi possível iniciar a câmera. Tente novamente.");
      }
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Erro ao parar scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Leitor de Código de Barras
          </DialogTitle>
          <DialogDescription>
            Posicione o código de barras no centro da câmera para leitura automática
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {permissionState === "checking" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verificando permissões...</p>
            </div>
          )}

          {permissionState === "prompt" && !error && (
            <div className="text-center py-8 space-y-4">
              <Camera className="h-16 w-16 mx-auto text-primary" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Permitir acesso à câmera</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Para ler códigos de barras, precisamos acessar a câmera do seu dispositivo.
                </p>
              </div>
              <Button onClick={requestCameraAccess} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Permitir Câmera
              </Button>
            </div>
          )}

          {permissionState === "denied" && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Câmera bloqueada</h3>
                <p className="text-muted-foreground text-sm">
                  O acesso à câmera foi negado. Para usar o leitor de código de barras:
                </p>
                <ol className="text-left text-sm mt-2 space-y-1 text-muted-foreground">
                  <li>1. Clique no ícone de cadeado/câmera na barra de endereço</li>
                  <li>2. Permita o acesso à câmera</li>
                  <li>3. Recarregue a página</li>
                </ol>
              </div>
            </div>
          )}

          {permissionState === "granted" && !error && (
            <>
              <div 
                id="barcode-scanner-container" 
                ref={containerRef}
                className="w-full min-h-[250px] rounded-lg overflow-hidden bg-muted"
              />
              <p className="text-sm text-muted-foreground text-center">
                Posicione o código de barras no centro da tela
              </p>
            </>
          )}

          {error && permissionState !== "denied" && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={requestCameraAccess} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
