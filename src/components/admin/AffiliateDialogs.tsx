import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  formatBRL, REFERRAL_CODE_RE, useAddAffiliate, useRegisterPayout, useRemoveAffiliate, useUpdateAffiliate,
  type AffiliateRow,
} from '@/hooks/useAffiliates';

const parseNum = (v: string) => Number(v.replace(',', '.'));

/** Sugestão de código a partir do nome (ex.: "Maria Souza" -> "MARIA10"). */
function suggestCode(name?: string | null) {
  const base = (name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return base.length >= 2 ? `${base}10` : '';
}

export interface AddAffiliatePrefill {
  userId?: string;
  name?: string | null;
  email?: string | null;
}

export function AddAffiliateDialog({
  open, onOpenChange, prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AddAffiliatePrefill;
}) {
  const add = useAddAffiliate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [commission, setCommission] = useState('3');
  const [discount, setDiscount] = useState('10');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmail(prefill?.email ?? '');
    setCode(suggestCode(prefill?.name));
    setCommission('3');
    setDiscount('10');
    setNotes('');
  }, [open, prefill]);

  const commissionN = parseNum(commission);
  const discountN = parseNum(discount);
  const codeOk = REFERRAL_CODE_RE.test(code);
  const valid = codeOk
    && (prefill?.userId || /^\S+@\S+\.\S+$/.test(email.trim()))
    && commissionN >= 0 && commissionN <= 50
    && Number.isInteger(discountN) && discountN >= 0 && discountN <= 50;

  const submit = () => {
    if (!valid) return;
    add.mutate(
      {
        userId: prefill?.userId,
        email: prefill?.userId ? undefined : email.trim(),
        code,
        commission: commissionN,
        discount: discountN,
        notes,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar afiliado</DialogTitle>
          <DialogDescription>
            {prefill?.userId
              ? `Conceder um código de afiliado para ${prefill.name || 'este usuário'}.`
              : 'Informe o e-mail de uma conta já cadastrada e confirmada.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!prefill?.userId && (
            <div className="space-y-1.5">
              <Label htmlFor="aff-email">E-mail do usuário</Label>
              <Input id="aff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="aff-code">Código de indicação</Label>
            <Input
              id="aff-code"
              value={code}
              maxLength={20}
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Ex.: MARIA10"
            />
            {code && !codeOk && <p className="text-xs text-destructive">Use de 4 a 20 letras ou números.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aff-commission">Comissão (%)</Label>
              <Input id="aff-commission" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aff-discount">Desconto p/ indicado (%)</Label>
              <Input id="aff-discount" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Limites: comissão 0–50% · desconto 0–50% (inteiro, aplicado na 1ª cobrança).</p>
          <div className="space-y-1.5">
            <Label htmlFor="aff-notes">Observações internas (opcional)</Label>
            <Textarea id="aff-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: parceria com canal do YouTube" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || add.isPending}>
            {add.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditAffiliateDialog({
  affiliate, onOpenChange,
}: {
  affiliate: AffiliateRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateAffiliate();
  const [commission, setCommission] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!affiliate) return;
    setCommission(String(affiliate.commission_percent));
    setDiscount(String(affiliate.discount_percent));
    setNotes(affiliate.notes ?? '');
  }, [affiliate]);

  const c = parseNum(commission);
  const d = parseNum(discount);
  const valid = c >= 0 && c <= 50 && Number.isInteger(d) && d >= 0 && d <= 50;

  return (
    <Dialog open={!!affiliate} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar condições — {affiliate?.code}</DialogTitle>
          <DialogDescription>Novos percentuais valem para as próximas vendas; comissões já geradas não mudam.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-commission">Comissão (%)</Label>
            <Input id="edit-commission" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-discount">Desconto (%)</Label>
            <Input id="edit-discount" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Observações internas</Label>
          <Textarea id="edit-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid || update.isPending}
            onClick={() => affiliate && update.mutate(
              { id: affiliate.id, commission: c, discount: d, notes },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveAffiliateDialog({
  affiliate, onOpenChange,
}: {
  affiliate: AffiliateRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useRemoveAffiliate();
  const [reason, setReason] = useState('');
  useEffect(() => { if (affiliate) setReason(''); }, [affiliate]);

  return (
    <Dialog open={!!affiliate} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remover afiliado {affiliate?.code}?</DialogTitle>
          <DialogDescription>
            O código deixa de funcionar imediatamente e não gera novas comissões. O histórico e o saldo
            pendente ({formatBRL(affiliate?.balance_due ?? 0)}) são preservados para prestação de contas.
            Você pode readicioná-lo depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="remove-reason">Motivo (registrado na auditoria)</Label>
          <Textarea id="remove-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => affiliate && remove.mutate({ id: affiliate.id, reason }, { onSuccess: () => onOpenChange(false) })}
          >
            {remove.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Remover do programa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayoutDialog({
  affiliate, onOpenChange,
}: {
  affiliate: AffiliateRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const pay = useRegisterPayout();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('pix');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (!affiliate) return;
    setAmount(affiliate.balance_due > 0 ? affiliate.balance_due.toFixed(2).replace('.', ',') : '');
    setMethod('pix');
    setReference('');
  }, [affiliate]);

  const value = parseNum(amount);
  const valid = !!affiliate && value > 0 && value <= affiliate.balance_due + 0.001;

  return (
    <Dialog open={!!affiliate} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {affiliate?.code}</DialogTitle>
          <DialogDescription>Saldo a pagar: {formatBRL(affiliate?.balance_due ?? 0)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Valor (R$)</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Identificador / comprovante (opcional)</Label>
            <Input id="pay-ref" value={reference} maxLength={200} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: ID da transação PIX" />
          </div>
          {amount && !valid && <p className="text-xs text-destructive">O valor deve ser maior que zero e até o saldo a pagar.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid || pay.isPending}
            onClick={() => affiliate && pay.mutate(
              { id: affiliate.id, amount: Math.round(value * 100) / 100, method, reference },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {pay.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
