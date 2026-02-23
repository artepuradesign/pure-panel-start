import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FileText, Download, ShoppingCart, CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { editaveisRgService, type EditavelRgArquivo, type EditavelRgCompra } from '@/services/editaveisRgService';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';

const EditaveisRg = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, loadBalance: reloadBalance } = useWalletBalance();

  const [arquivos, setArquivos] = useState<EditavelRgArquivo[]>([]);
  const [compras, setCompras] = useState<EditavelRgCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprasLoading, setComprasLoading] = useState(true);
  const [selectedArquivo, setSelectedArquivo] = useState<EditavelRgArquivo | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const walletBalance = balance.saldo || 0;
  const planBalance = balance.saldo_plano || 0;
  const totalBalance = walletBalance + planBalance;

  const loadArquivos = useCallback(async () => {
    try {
      setLoading(true);
      const result = await editaveisRgService.listArquivos({ limit: 100 });
      if (result.success && result.data) {
        setArquivos(result.data.data || []);
      } else {
        setArquivos([]);
      }
    } catch {
      setArquivos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompras = useCallback(async () => {
    try {
      setComprasLoading(true);
      const result = await editaveisRgService.minhasCompras({ limit: 100 });
      if (result.success && result.data) {
        setCompras(result.data.data || []);
      } else {
        setCompras([]);
      }
    } catch {
      setCompras([]);
    } finally {
      setComprasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadArquivos();
    loadCompras();
    reloadBalance();
  }, [user, loadArquivos, loadCompras, reloadBalance]);

  const handleSelectArquivo = (arquivo: EditavelRgArquivo) => {
    if (arquivo.comprado) {
      handleDownload(arquivo.id);
      return;
    }
    setSelectedArquivo(arquivo);
    setShowConfirmModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedArquivo) return;
    setIsPurchasing(true);

    try {
      const walletType = planBalance >= selectedArquivo.preco ? 'plan' : 'main';
      const result = await editaveisRgService.comprar(selectedArquivo.id, walletType);

      if (result.success && result.data) {
        toast.success(`Arquivo "${result.data.titulo}" adquirido com sucesso!`);
        setShowConfirmModal(false);
        setSelectedArquivo(null);

        if (result.data.ja_comprado) {
          window.open(result.data.arquivo_url, '_blank');
        }

        await Promise.all([loadArquivos(), loadCompras(), reloadBalance()]);
      } else {
        toast.error(result.error || 'Erro ao adquirir arquivo');
      }
    } catch (error) {
      toast.error('Erro ao processar compra');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDownload = async (arquivoId: number) => {
    try {
      const result = await editaveisRgService.download(arquivoId);
      if (result.success && result.data) {
        window.open(result.data.arquivo_url, '_blank');
        toast.success(`Download de "${result.data.titulo}" iniciado`);
        loadArquivos();
        loadCompras();
      } else {
        toast.error(result.error || 'Erro ao baixar arquivo');
      }
    } catch {
      toast.error('Erro ao processar download');
    }
  };

  const formatPrice = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-4">
      <SimpleTitleBar
        title="Editáveis RG"
        subtitle="Arquivos editáveis em CorelDraw (.CDR)"
        onBack={() => navigate('/dashboard')}
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Lista de Arquivos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando arquivos...</span>
        </div>
      ) : arquivos.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum arquivo disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {arquivos.map((arquivo) => (
            <Card
              key={arquivo.id}
              className={`bg-card border-border hover:shadow-lg transition-shadow cursor-pointer ${
                arquivo.comprado ? 'ring-2 ring-green-500/30' : ''
              }`}
              onClick={() => handleSelectArquivo(arquivo)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{arquivo.titulo}</CardTitle>
                  {arquivo.comprado && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Adquirido
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {arquivo.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{arquivo.descricao}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">{arquivo.formato || '.CDR'}</Badge>
                  {arquivo.tamanho_arquivo && (
                    <Badge variant="outline" className="text-xs">{arquivo.tamanho_arquivo}</Badge>
                  )}
                  {arquivo.categoria && (
                    <Badge variant="outline" className="text-xs">{arquivo.categoria}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-lg font-bold text-primary">{formatPrice(arquivo.preco)}</span>
                  <Button
                    size="sm"
                    variant={arquivo.comprado ? 'outline' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectArquivo(arquivo);
                    }}
                  >
                    {arquivo.comprado ? (
                      <>
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Comprar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Histórico de Compras */}
      {!comprasLoading && compras.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Histórico de Compras
          </h3>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Preço Pago</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell className="font-medium">{compra.titulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{compra.formato || '.CDR'}</Badge>
                      </TableCell>
                      <TableCell>{formatPrice(compra.preco_pago)}</TableCell>
                      <TableCell>{compra.downloads_count}x</TableCell>
                      <TableCell>{new Date(compra.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleDownload(compra.arquivo_id)}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Confirmação de Compra */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Confirmar Compra
            </DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de confirmar a aquisição do arquivo.
            </DialogDescription>
          </DialogHeader>

          {selectedArquivo && (
            <div className="space-y-4">
              <Card className="bg-muted/50 border-border">
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold text-foreground">{selectedArquivo.titulo}</p>
                  {selectedArquivo.descricao && (
                    <p className="text-sm text-muted-foreground">{selectedArquivo.descricao}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{selectedArquivo.formato || '.CDR'}</Badge>
                    {selectedArquivo.tamanho_arquivo && (
                      <Badge variant="outline">{selectedArquivo.tamanho_arquivo}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço:</span>
                  <span className="font-semibold text-foreground">{formatPrice(selectedArquivo.preco)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo disponível:</span>
                  <span className={`font-semibold ${totalBalance >= selectedArquivo.preco ? 'text-green-600' : 'text-destructive'}`}>
                    {formatPrice(totalBalance)}
                  </span>
                </div>
                {totalBalance < selectedArquivo.preco && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-xs">Saldo insuficiente para esta compra.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isPurchasing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={isPurchasing || !selectedArquivo || totalBalance < (selectedArquivo?.preco || 0)}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Compra
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditaveisRg;
