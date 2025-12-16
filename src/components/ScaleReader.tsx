import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, Plug, Unplug, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Web Serial API Types
interface SerialPort {
  readable: ReadableStream | null;
  writable: WritableStream | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
}

interface Serial {
  requestPort(): Promise<SerialPort>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

interface ScaleReaderProps {
  onWeightRead: (weight: number) => void;
  isReadingEnabled?: boolean;
}

export const ScaleReader = ({ onWeightRead, isReadingEnabled = true }: ScaleReaderProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se Web Serial API é suportada
    setIsSupported("serial" in navigator);
  }, []);

  const parseWeight = useCallback((data: string): number | null => {
    // Protocolos comuns de balanças (Toledo, Filizola, etc.)
    // Formato típico: "ST,GS,+000.000kg" ou similar
    
    // Tentar extrair peso de diferentes formatos
    const patterns = [
      /([+-]?\d+\.?\d*)\s*kg/i,           // 1.234kg ou 1.234 kg
      /([+-]?\d+\.?\d*)\s*g/i,            // 1234g (converter para kg)
      /ST,GS,([+-]?\d+\.?\d*)/,           // Formato Toledo
      /([+-]?\d{1,3}\.\d{3})/,            // Formato genérico 000.000
      /\b(\d+\.?\d*)\b/,                   // Qualquer número decimal
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match) {
        let weight = parseFloat(match[1]);
        // Se encontrou em gramas, converter para kg
        if (pattern.source.includes('g') && !pattern.source.includes('kg') && weight > 100) {
          weight = weight / 1000;
        }
        if (!isNaN(weight) && weight >= 0 && weight < 1000) {
          return weight;
        }
      }
    }
    return null;
  }, []);

  const readFromPort = useCallback(async () => {
    if (!portRef.current) return;

    try {
      const decoder = new TextDecoder();
      let buffer = "";

      while (portRef.current?.readable) {
        readerRef.current = portRef.current.readable.getReader();
        
        try {
          while (true) {
            const { value, done } = await readerRef.current.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Procurar por linha completa (geralmente termina com \r\n ou \n)
            const lines = buffer.split(/[\r\n]+/);
            buffer = lines.pop() || ""; // Manter dados incompletos no buffer
            
            for (const line of lines) {
              if (line.trim()) {
                const weight = parseWeight(line);
                if (weight !== null) {
                  setCurrentWeight(weight);
                  if (isReadingEnabled) {
                    onWeightRead(weight);
                  }
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== "NetworkError") {
            console.error("Erro na leitura:", error);
          }
        } finally {
          readerRef.current?.releaseLock();
        }
      }
    } catch (error) {
      console.error("Erro ao ler porta:", error);
    }
  }, [parseWeight, onWeightRead, isReadingEnabled]);

  const connectScale = useCallback(async () => {
    if (!isSupported || !navigator.serial) {
      setShowUnsupportedDialog(true);
      return;
    }

    try {
      // Solicitar porta serial
      const port = await navigator.serial.requestPort();
      
      // Configurações comuns de balanças (9600 baud é o mais comum)
      await port.open({ 
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      portRef.current = port;
      setIsConnected(true);
      
      toast({
        title: "Balança conectada",
        description: "Leitura de peso ativada",
      });

      // Iniciar leitura
      readFromPort();
    } catch (error) {
      console.error("Erro ao conectar balança:", error);
      if ((error as Error).name !== "NotFoundError") {
        toast({
          title: "Erro ao conectar",
          description: "Não foi possível conectar à balança. Verifique a conexão.",
          variant: "destructive",
        });
      }
    }
  }, [isSupported, readFromPort, toast]);

  const disconnectScale = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
      setIsConnected(false);
      setCurrentWeight(null);
      
      toast({
        title: "Balança desconectada",
      });
    } catch (error) {
      console.error("Erro ao desconectar:", error);
    }
  }, [toast]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <Scale className="h-3 w-3" />
              {currentWeight !== null ? `${currentWeight.toFixed(3)} kg` : "Aguardando..."}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={disconnectScale}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Desconectar balança"
            >
              <Unplug className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={connectScale}
            className="gap-2"
          >
            <Plug className="h-4 w-4" />
            Conectar Balança
          </Button>
        )}
      </div>

      {/* Dialog para navegador não suportado */}
      <Dialog open={showUnsupportedDialog} onOpenChange={setShowUnsupportedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Navegador não suportado
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                A integração com balança usa a tecnologia Web Serial API, que só está disponível em:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Google Chrome</strong> (versão 89+)</li>
                <li><strong>Microsoft Edge</strong> (versão 89+)</li>
                <li><strong>Opera</strong> (versão 76+)</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Navegadores como Safari, Firefox e navegadores mobile ainda não suportam esta funcionalidade.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScaleReader;
