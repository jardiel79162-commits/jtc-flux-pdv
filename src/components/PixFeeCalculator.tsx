import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calculator } from "lucide-react";

interface PixFeeCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PIX_FEE_RATE = 0.0049; // 0.49%

export const PixFeeCalculator = ({ open, onOpenChange }: PixFeeCalculatorProps) => {
  const [amount, setAmount] = useState("");
  const [passToCustomer, setPassToCustomer] = useState(false);

  const numericAmount = parseFloat(amount.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
  
  // Calculate fee
  const fee = numericAmount * PIX_FEE_RATE;
  
  // If passing to customer: customer pays original + fee, you receive original
  // If not passing: customer pays original, you receive original - fee
  const customerPays = passToCustomer ? numericAmount + fee : numericAmount;
  const youReceive = passToCustomer ? numericAmount : numericAmount - fee;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, "");
    if (value) {
      const numValue = parseInt(value) / 100;
      value = numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    setAmount(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Taxa PIX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Valor da venda</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-10 text-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <Label htmlFor="pass-fee" className="cursor-pointer">
              Repassar taxa para o cliente?
            </Label>
            <Switch
              id="pass-fee"
              checked={passToCustomer}
              onCheckedChange={setPassToCustomer}
            />
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Taxa PIX: 0,49%
          </div>

          {numericAmount > 0 && (
            <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa cobrada:</span>
                <span className="font-medium text-destructive">- {formatCurrency(fee)}</span>
              </div>
              
              <div className="border-t border-border pt-3 space-y-2">
                {passToCustomer ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente paga:</span>
                      <span className="font-bold text-lg">{formatCurrency(customerPays)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Você recebe:</span>
                      <span className="font-bold text-lg text-green-600">{formatCurrency(youReceive)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente paga:</span>
                      <span className="font-medium">{formatCurrency(customerPays)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cai na sua conta:</span>
                      <span className="font-bold text-lg text-green-600">{formatCurrency(youReceive)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              setAmount("");
              setPassToCustomer(false);
            }}
          >
            Limpar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
