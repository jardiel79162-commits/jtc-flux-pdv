import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

const OfflineDetector = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-6">
        {/* Animated WiFi Icon */}
        <div className="relative">
          <div className="animate-pulse">
            <WifiOff className="h-24 w-24 text-muted-foreground" />
          </div>
          {/* Ping animation rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute h-32 w-32 rounded-full border-2 border-muted-foreground/30 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute h-40 w-40 rounded-full border-2 border-muted-foreground/20 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Erro de Conexão</h2>
          <p className="text-muted-foreground max-w-xs">
            Sem conexão com a internet. Verifique sua rede e tente novamente.
          </p>
        </div>

        {/* Loading dots animation */}
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>

        <p className="text-sm text-muted-foreground/70">
          Reconectando automaticamente...
        </p>
      </div>
    </div>
  );
};

export default OfflineDetector;
