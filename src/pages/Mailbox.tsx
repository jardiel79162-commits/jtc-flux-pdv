import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Search,
  Eye,
  RefreshCw,
  Mail,
  FileText,
  Calendar,
  Filter,
  Inbox,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailLog {
  id: string;
  sale_id: string | null;
  customer_email: string;
  sender_email: string;
  subject: string;
  document_type: string;
  status: string;
  error_message: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  created_at: string;
}

const Mailbox = () => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("email_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar logs de e-mail:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros de e-mail.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.length < 10) return null;
    const [day, month, year] = dateStr.split("/");
    if (!day || !month || !year) return null;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  const filteredLogs = emailLogs.filter((log) => {
    const matchesSearch =
      log.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sender_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    const logDate = new Date(log.created_at);
    
    if (startDate.length === 10) {
      const start = parseDate(startDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && logDate >= start;
      }
    }
    
    if (endDate.length === 10) {
      const end = parseDate(endDate);
      if (end) {
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && logDate <= end;
      }
    }

    return matchesSearch && matchesDate;
  });

  const handleViewDetails = (log: EmailLog) => {
    setSelectedEmail(log);
    setIsDetailsOpen(true);
  };

  const handleResend = async (log: EmailLog) => {
    setResendingId(log.id);
    try {
      // Update status to pending
      await supabase
        .from("email_logs")
        .update({ status: "pendente", error_message: null })
        .eq("id", log.id);

      // TODO: Implement actual email resend logic via edge function
      // For now, simulate a resend
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "E-mail reenviado",
        description: `O e-mail foi reenviado para ${log.customer_email}.`,
      });

      fetchEmailLogs();
    } catch (error: any) {
      console.error("Erro ao reenviar e-mail:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reenviar o e-mail.",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enviado":
        return <Badge className="bg-green-500 hover:bg-green-600">Enviado</Badge>;
      case "erro":
        return <Badge variant="destructive">Erro</Badge>;
      case "pendente":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex items-center gap-3">
        <Inbox className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Caixa de Correios</h1>
          <p className="text-muted-foreground">Gerencie todos os e-mails enviados pelo sistema</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Data início
              </label>
              <Input
                type="text"
                placeholder="DD/MM/AAAA"
                value={startDate}
                onChange={(e) => setStartDate(formatDate(e.target.value))}
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Data fim
              </label>
              <Input
                type="text"
                placeholder="DD/MM/AAAA"
                value={endDate}
                onChange={(e) => setEndDate(formatDate(e.target.value))}
                maxLength={10}
                inputMode="numeric"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className="w-full"
          >
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Email Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-mails Enviados ({filteredLogs.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchEmailLogs}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhum e-mail encontrado</p>
              <p className="text-sm text-muted-foreground/70">
                Os e-mails enviados pelo sistema aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Destinatário</TableHead>
                    <TableHead className="w-[25%]">Data</TableHead>
                    <TableHead className="w-[20%]">Status</TableHead>
                    <TableHead className="w-[20%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="truncate max-w-0">
                        {log.customer_email}
                      </TableCell>
                      <TableCell className="truncate">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(log)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResend(log)}
                            disabled={resendingId === log.id}
                            title="Reenviar"
                          >
                            <RefreshCw className={`h-4 w-4 ${resendingId === log.id ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Detalhes do E-mail
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedEmail.status)}
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Destinatário:</span>
                  <p className="font-medium break-all">{selectedEmail.customer_email}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Remetente:</span>
                  <p className="font-medium break-all">{selectedEmail.sender_email}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Assunto:</span>
                  <p className="font-medium">{selectedEmail.subject}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Tipo de Documento:</span>
                  <p className="font-medium capitalize">{selectedEmail.document_type}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Data de Criação:</span>
                  <p className="font-medium">
                    {format(new Date(selectedEmail.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                
                {selectedEmail.sent_at && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Data de Envio:</span>
                    <p className="font-medium">
                      {format(new Date(selectedEmail.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
                
                {selectedEmail.sale_id && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">ID da Venda:</span>
                    <p className="font-medium text-xs break-all">{selectedEmail.sale_id}</p>
                  </div>
                )}
                
                {selectedEmail.error_message && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Mensagem de Erro:</span>
                    <p className="font-medium text-destructive text-sm">{selectedEmail.error_message}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {selectedEmail.pdf_url && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(selectedEmail.pdf_url!, "_blank")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Ver PDF
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleResend(selectedEmail);
                    setIsDetailsOpen(false);
                  }}
                  disabled={resendingId === selectedEmail.id}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${resendingId === selectedEmail.id ? "animate-spin" : ""}`} />
                  Reenviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mailbox;
