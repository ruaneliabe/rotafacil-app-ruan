import React, { useState } from 'react';
import { Order, OrderItem, PaymentMethod } from '../types';
import { INITIAL_ITEMS_MENU } from '../data/initialData';
import { geocodeAddress } from '../utils/geoUtils';
import {
  X,
  Plus,
  Minus,
  Trash2,
  User,
  Search,
  Bot,
  Sparkles,
  ShoppingBag,
  CreditCard,
  QrCode,
  Wallet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Zap,
  Globe,
  Utensils,
  Store,
  Package,
} from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (newOrder: Omit<Order, 'id' | 'codeNumber' | 'status' | 'createdAt' | 'trackingCode'>) => void;
  nextOrderCode: number;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onAddOrder,
  nextOrderCode,
}) => {
  const [showImportBox, setShowImportBox] = useState(true);
  const [pastedText, setPastedText] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const [menuCatalog, setMenuCatalog] = useState<{ name: string; price: number }[]>(INITIAL_ITEMS_MENU);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [isParsing, setIsParsing] = useState(false);
  const [aiStepText, setAiStepText] = useState('');
  const [highlightFields, setHighlightFields] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [originChannel, setOriginChannel] = useState<'ifood' | 'cardapio_web' | 'whatsapp' | 'pdv' | 'manual'>('whatsapp');
  const [kitchenReadyInMin, setKitchenReadyInMin] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [deliveryFee, setDeliveryFee] = useState<number>(7.0);

  const [searchProduct, setSearchProduct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParsePastedText = async () => {
    if (!pastedText.trim() || isParsing) return;

    setIsParsing(true);
    setAiStepText('Entendendo mensagem...');
    await new Promise((r) => setTimeout(r, 150));

    setAiStepText('Identificando Cliente e Endereço...');
    await new Promise((r) => setTimeout(r, 150));

    setAiStepText('Extraindo Produtos e Preços...');
    await new Promise((r) => setTimeout(r, 150));

    const lines = pastedText.split('\n').map((l) => l.trim()).filter(Boolean);

    let name = '';
    let phone = '';
    let addr = '';
    let neigh = '';
    let parsedFee: number | null = null;
    let pay: PaymentMethod = 'pix';
    let changeForVal: number | undefined = undefined;
    let subtotal = 0;

    // 1. Phone extraction
    const phoneMatch = pastedText.match(/(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]*\d{4}/);
    if (phoneMatch) {
      phone = phoneMatch[0].trim();
    }

    // 2. Delivery Fee extraction
    const deliveryMatch = pastedText.match(/(?:entrega|taxa|frete)[^R$\d]*r?\$\s*(\d+[.,]\d{2}|\d+)/i);
    if (deliveryMatch) {
      const num = parseFloat(deliveryMatch[1].replace(',', '.'));
      if (!isNaN(num)) parsedFee = num;
    }

    // 3. Subtotal extraction
    const subtotalMatch = pastedText.match(/subtotal[^R$\d]*r?\$\s*(\d+[.,]\d{2}|\d+)/i);
    if (subtotalMatch) {
      const num = parseFloat(subtotalMatch[1].replace(',', '.'));
      if (!isNaN(num)) subtotal = num;
    }

    // 4. Payment Method
    const lowerText = pastedText.toLowerCase();
    if (
      lowerText.includes('cartão') ||
      lowerText.includes('cartao') ||
      lowerText.includes('crédito') ||
      lowerText.includes('credito') ||
      lowerText.includes('débito') ||
      lowerText.includes('debito') ||
      lowerText.includes('maquininha')
    ) {
      pay = 'cartao_maquininha';
    } else if (lowerText.includes('dinheiro') || lowerText.includes('espécie') || lowerText.includes('especie')) {
      pay = 'dinheiro';
      const trocoMatch = pastedText.match(/troco\s*(?:para|p\/)?\s*r?\$\s*(\d+[.,]?\d*)/i);
      if (trocoMatch) {
        const num = parseFloat(trocoMatch[1].replace(',', '.'));
        if (!isNaN(num)) changeForVal = num;
      }
    } else if (lowerText.includes('pix')) {
      pay = 'pix';
    }

    // 5. Line by line for Name, Address, Neighborhood
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Name
      if (line.startsWith('👤') || lower.startsWith('cliente:') || lower.startsWith('nome:')) {
        const extracted = line
          .replace(/^👤/, '')
          .replace(/^cliente:/i, '')
          .replace(/^nome:/i, '')
          .trim();
        if (extracted && extracted.length > 2) name = extracted;
      }

      // Phone
      if (line.startsWith('📞') || lower.startsWith('fone:') || lower.startsWith('tel:') || lower.startsWith('whatsapp:')) {
        const extracted = line
          .replace(/^📞/, '')
          .replace(/^fone:/i, '')
          .replace(/^tel:/i, '')
          .replace(/^whatsapp:/i, '')
          .trim();
        if (extracted) phone = extracted;
      }

      // Address
      if (lower.startsWith('endereço:') || lower.startsWith('rua:')) {
        const extracted = line.replace(/^endereço:/i, '').replace(/^rua:/i, '').trim();
        if (extracted) addr = extracted;
      } else if (line.startsWith('🛵') || lower.includes('endereço de entrega')) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (!nextLine.startsWith('http') && !nextLine.toLowerCase().includes('link') && !nextLine.toLowerCase().includes('bairro:')) {
            addr = nextLine.replace(/^[*#]/g, '').trim();
          }
        }
      }

      // Neighborhood
      if (lower.includes('bairro:')) {
        const extracted = line.split(/bairro:/i)[1]?.trim();
        if (extracted) neigh = extracted;
      }
    }

    // Fallback for Name if not prefixed
    if (!name) {
      for (const line of lines) {
        const l = line.toLowerCase();
        if (
          !l.includes('pedido') &&
          !l.includes('feito em') &&
          !l.includes('http') &&
          !l.includes('link') &&
          !l.includes('itens') &&
          !l.includes('subtotal') &&
          !l.includes('entrega') &&
          !l.includes('pagamento') &&
          !l.startsWith('#') &&
          line.length > 2
        ) {
          name = line.replace(/^[👤🛵📞#️⃣*•\s]+/, '').split(':')[0].trim();
          break;
        }
      }
    }

    // 6. Extract Items
    const itemsFound: OrderItem[] = [];
    let currentItem: OrderItem | null = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const lower = trimmed.toLowerCase();

      // Skip non-item metadata
      if (
        lower.includes('novo pedido') ||
        lower.includes('nº pedido') ||
        lower.includes('feito em') ||
        lower.includes('endereço') ||
        lower.includes('bairro:') ||
        lower.includes('link do endereço') ||
        lower.includes('subtotal') ||
        lower.includes('entrega:') ||
        lower.includes('valor final') ||
        lower.includes('pagamento') ||
        lower.includes('cartão') ||
        lower.includes('itens do pedido') ||
        lower.startsWith('http')
      ) {
        continue;
      }

      // Explicit price line for previous item
      if (trimmed.startsWith('💵') || (trimmed.includes('r$') && currentItem && (trimmed.includes('=') || trimmed.includes('x r$')))) {
        const priceMatch = trimmed.match(/r\$\s*(\d+[.,]\d{2}|\d+)/i);
        if (priceMatch && currentItem) {
          const val = parseFloat(priceMatch[1].replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            currentItem.price = val / currentItem.quantity;
          }
        }
        continue;
      }

      // Check if line starts with a main item quantity: e.g. "1 x Caixa Para Dois", "2x X-Bacon"
      const qtyMatch = trimmed.match(/^[-*•]?\s*(\d+)\s*[xX-]?\s+(.+)/);
      const isOptionLine =
        trimmed.startsWith('-') ||
        trimmed.startsWith('•') ||
        lower.startsWith('escolha') ||
        lower.startsWith('gostaria de');

      if (qtyMatch && !isOptionLine) {
        const qty = parseInt(qtyMatch[1], 10) || 1;
        let restName = qtyMatch[2].trim();

        let price = 0;
        const priceMatch = restName.match(/r\$\s*(\d+[.,]\d{2}|\d+)/i);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(',', '.'));
          restName = restName.replace(priceMatch[0], '').replace(/[-()=]/g, '').trim();
        }

        const cleanName = restName.replace(/^itens:\s*/i, '').replace(/[-:]+$/, '').trim();
        if (cleanName.length > 2) {
          currentItem = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            name: cleanName,
            price: price,
            quantity: qty,
          };
          itemsFound.push(currentItem);
        }
      }
    }

    // Handle prices fallback or catalog lookup
    itemsFound.forEach((item) => {
      if (item.price === 0) {
        const matchCatalog = menuCatalog.find(
          (m) => item.name.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(item.name.toLowerCase())
        );
        if (matchCatalog) {
          item.price = matchCatalog.price;
        } else if (subtotal > 0 && itemsFound.length === 1) {
          item.price = subtotal / item.quantity;
        } else {
          item.price = 28.0;
        }
      }
    });

    if (itemsFound.length > 0) {
      // Memorize new items in catalog
      setMenuCatalog((prev) => {
        const next = [...prev];
        itemsFound.forEach((ei) => {
          if (!next.some((m) => m.name.toLowerCase() === ei.name.toLowerCase())) {
            next.push({ name: ei.name, price: ei.price });
          }
        });
        return next;
      });
    }

    setClientName(name || 'Cliente Sem Nome');
    if (phone) setClientPhone(phone);
    if (addr) {
      setAddress(addr);
      const parts = addr.split(',');
      if (parts.length > 1) {
        setStreet(parts[0].trim());
        const rest = parts.slice(1).join(',').trim();
        const numMatch = rest.match(/^nº?\s*(\d+[a-zA-Z]?)/i) || rest.match(/^(\d+[a-zA-Z]?)/);
        if (numMatch) {
          setHouseNumber(numMatch[1]);
          const afterNum = rest.replace(numMatch[0], '').replace(/^[-,\s]+/, '').trim();
          if (afterNum) setComplement(afterNum);
        } else {
          setComplement(rest);
        }
      } else {
        const numMatch = addr.match(/,\s*nº?\s*(\d+)/i) || addr.match(/\s+(\d+)\b/);
        if (numMatch) {
          setHouseNumber(numMatch[1]);
          setStreet(addr.replace(numMatch[0], '').trim());
        } else {
          setStreet(addr);
        }
      }
    }
    if (neigh) setNeighborhood(neigh);
    if (parsedFee !== null) setDeliveryFee(parsedFee);
    if (changeForVal !== undefined) setChangeFor(changeForVal);
    setPaymentMethod(pay);
    setSelectedItems(itemsFound);

    setIsParsing(false);
    setHighlightFields(true);

    const totalQty = itemsFound.reduce((a, b) => a + b.quantity, 0);
    const calculatedSubtotal = itemsFound.reduce((a, b) => a + b.price * b.quantity, 0);
    const currentFee = parsedFee !== null ? parsedFee : deliveryFee;
    setImportSuccessMsg(`Pedido montado com sucesso! • ${totalQty} item(ns) • Total: R$ ${(calculatedSubtotal + currentFee).toFixed(2).replace('.', ',')}`);

    setTimeout(() => {
      setHighlightFields(false);
    }, 1800);

    setTimeout(() => {
      setImportSuccessMsg(null);
    }, 6000);
  };

  const handleAddItem = (menuItem: { name: string; price: number }) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.name === menuItem.name);
      if (existing) {
        return prev.map((i) => (i.name === menuItem.name ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: Date.now().toString(), name: menuItem.name, price: menuItem.price, quantity: 1 }];
    });
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddCustomItem = () => {
    if (!customName.trim()) return;
    const priceNum = parseFloat(customPrice.replace(',', '.')) || 0;
    const newItem = { name: customName.trim(), price: priceNum };
    handleAddItem(newItem);
    setMenuCatalog((prev) => {
      if (!prev.some((m) => m.name.toLowerCase() === newItem.name.toLowerCase())) {
        return [...prev, newItem];
      }
      return prev;
    });
    setCustomName('');
    setCustomPrice('');
    setShowCustomInput(false);
  };

  const filteredMenu = menuCatalog.filter((item) =>
    item.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const subtotal = selectedItems.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  const safeDeliveryFee = typeof deliveryFee === 'number' && !isNaN(deliveryFee) ? deliveryFee : 0;
  const total = subtotal + safeDeliveryFee;

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const finalStreet = street.trim() || address.trim();
    const finalNumber = houseNumber.trim();
    const finalComp = complement.trim();

    let fullFormattedAddress = finalStreet;
    if (finalNumber) fullFormattedAddress += `, Nº ${finalNumber}`;
    if (finalComp) fullFormattedAddress += ` (${finalComp})`;

    if (!clientName || !fullFormattedAddress || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let lat: number | null = null;
      let lng: number | null = null;

      try {
        const query = `${finalStreet}${finalNumber ? `, ${finalNumber}` : ''}, ${neighborhood || 'Centro'}, Blumenau - SC`;
        const geoResult = await geocodeAddress(query);
        if (geoResult && geoResult.lat && geoResult.lng) {
          lat = geoResult.lat;
          lng = geoResult.lng;
        }
      } catch (err) {
        console.warn('Geocoding failed:', err);
      }

      if (lat === null || lng === null) {
        // Fallback to city center coordinates with slight offset instead of blocking the merchant
        lat = -26.9194 + (Math.random() - 0.5) * 0.015;
        lng = -49.0661 + (Math.random() - 0.5) * 0.015;
      }

      let finalItems = [...selectedItems];
      if (finalItems.length === 0) {
        finalItems = [
          {
            id: Date.now().toString(),
            name: 'Pedido / Lanche Diversos',
            price: 28.0,
            quantity: 1,
          },
        ];
      }

      const calcSubtotal = finalItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const calcTotal = calcSubtotal + safeDeliveryFee;
      const itemsSummary = finalItems.map((i) => `${i.quantity}x ${i.name}`).join(', ');

      onAddOrder({
        clientName,
        clientPhone: clientPhone.trim(),
        address: fullFormattedAddress,
        street: finalStreet,
        houseNumber: finalNumber,
        complement: finalComp,
        neighborhood: neighborhood || 'Centro',
        lat,
        lng,
        items: finalItems,
        itemsSummary,
        subtotal: calcSubtotal,
        deliveryFee: safeDeliveryFee,
        total: calcTotal,
        paymentMethod,
        changeFor,
        estimatedMinutes: 25,
        assignedMotoboyId: null,
        assignedMotoboyName: null,
        originChannel,
        kitchenReadyInMin,
      });

      onClose();
    } catch (err) {
      console.error('Error submitting order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-black">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">
                  Lançar Pedido #{nextOrderCode}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  PDV Rápido
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Expedição e Despacho p/ Motoboy</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Bar Indicator */}
        <div className="px-5 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-300 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cole a mensagem do WhatsApp ou digite os dados do pedido</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 hidden sm:flex">
            <span>Leitura Inteligente IA</span>
            <span>•</span>
            <span>Endereço & Mapa</span>
            <span>•</span>
            <span>Despacho Automático</span>
          </div>
        </div>

        {/* Success Toast Banner */}
        {importSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-5 py-2.5 text-emerald-300 font-bold text-xs flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body: 2 Columns on MD/LG */}
        <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-slate-800">
          
          {/* LEFT COLUMN: Data Entry (7 cols) */}
          <div className="md:col-span-7 p-5 space-y-5 bg-slate-900">
            
            {/* 1. Importar Pedido de Qualquer Plataforma */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                      Cole a mensagem ou comanda do pedido
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Suporta WhatsApp, iFood, Cardápio Web, Anota AI e anotações
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportBox(true);
                      setPastedText(
                        `João:\nBoa noite!\n\nQuero:\n2 X-Bacon\n1 Batata Rústica\n1 Coca 2L\n\nForma de Pagamento: PIX\n\nEndereço: Rua XV de Novembro, 888 - Centro`
                      );
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Utensils className="w-3 h-3 text-emerald-400" /> Testar Exemplo
                  </button>
                </div>
              </div>

              {showImportBox && (
                <div className="space-y-2.5 pt-1">
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={`João:\nBoa noite!\n\nQuero:\n2 X-Bacon\n1 Batata\n1 Coca 2L\n\nPIX\n\nRua XV de Novembro, 888 - Centro`}
                      className="w-full p-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed placeholder:text-slate-500 shadow-inner"
                    />
                    <div className="absolute right-2.5 bottom-2 text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {pastedText.length > 0 ? `${pastedText.length} caracteres` : 'Mensagem vazia'}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      disabled={isParsing || !pastedText.trim()}
                      className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isParsing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>{aiStepText}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-slate-950" />
                          <span>Montar Pedido com IA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dados do Cliente */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                Dados do Cliente
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1 text-[11px]">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                      highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1 text-[11px]">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(47) 99999-8888"
                    className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                      highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">Rua / Logradouro *</label>
                    <input
                      type="text"
                      required
                      value={street}
                      onChange={(e) => {
                        setStreet(e.target.value);
                        setAddress(e.target.value);
                      }}
                      placeholder="Ex: Rua XV de Novembro"
                      className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                        highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">Nº Residência *</label>
                    <input
                      type="text"
                      required
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="Ex: 653 ou S/N"
                      className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                        highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">Complemento (Apto, Bloco)</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Ex: Apto 201, Bloco B"
                      className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                        highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">Bairro *</label>
                    <input
                      type="text"
                      required
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Ex: Velha Central"
                      className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-xs text-white transition-all ${
                        highlightFields ? 'ring-2 ring-emerald-500 bg-slate-900' : ''
                      }`}
                    />
                  </div>
                </div>
              {/* 2.1 Origem do Pedido e Tempo de Cozinha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-slate-300 block mb-1 text-[11px] flex items-center justify-between">
                    <span>Canal / Origem do Pedido</span>
                    <span className="text-[10px] text-emerald-400 font-extrabold uppercase">Agnóstico</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setOriginChannel('whatsapp')}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        originChannel === 'whatsapp'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="WhatsApp / Pedido Direto"
                    >
                      <span className="text-xs">💬</span>
                      <span>Whats</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOriginChannel('ifood')}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        originChannel === 'ifood'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="iFood Delivery"
                    >
                      <span className="text-xs">🔴</span>
                      <span>iFood</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOriginChannel('cardapio_web')}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        originChannel === 'cardapio_web'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Cardápio Web / Site Próprio"
                    >
                      <span className="text-xs">🌐</span>
                      <span>Cardápio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOriginChannel('pdv')}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        originChannel === 'pdv'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="PDV / Anota AI / Sistema Interno"
                    >
                      <span className="text-xs">💻</span>
                      <span>PDV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOriginChannel('manual')}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        originChannel === 'manual'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Telefone ou Balcão"
                    >
                      <span className="text-xs">📞</span>
                      <span>Manual</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1 text-[11px] flex items-center justify-between">
                    <span>Previsão da Cozinha</span>
                    <span className="text-[10px] text-amber-400 font-extrabold uppercase">Sincronia</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setKitchenReadyInMin(0)}
                      className={`py-2 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        kitchenReadyInMin === 0
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      ✅ Pronto Já
                    </button>
                    <button
                      type="button"
                      onClick={() => setKitchenReadyInMin(5)}
                      className={`py-2 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        kitchenReadyInMin === 5
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      ⏳ ~5 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setKitchenReadyInMin(12)}
                      className={`py-2 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        kitchenReadyInMin === 12
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      🔥 ~12 min
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* 3. Adicionar Item Manualmente */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="text-[11px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{showCustomInput ? 'Esconder adição manual' : '+ Adicionar item manual (opcional)'}</span>
                </button>
                <span className="text-[10px] text-slate-500">Opcional</span>
              </div>

              {showCustomInput && (
                <div className="flex gap-2 animate-fadeIn p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    placeholder="Nome do item (ex: 1x Coca-Cola Lata)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  <input
                    type="text"
                    placeholder="R$ 0,00"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 text-center font-bold text-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4 text-slate-950" />
                    <span>Incluir</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Resumo do Pedido / Check-out Panel (5 cols) */}
          <div className="md:col-span-5 bg-slate-950 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  Resumo da Bolsa ({selectedItems.reduce((a, b) => a + b.quantity, 0)} itens)
                </h4>
                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedItems([])}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Selected Items List */}
              {selectedItems.length === 0 ? (
                <div className="border border-dashed border-slate-800 bg-slate-900/60 rounded-2xl p-6 text-center space-y-2 my-auto">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center mx-auto shadow-2xs">
                    <Package className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-xs text-white font-bold">Os itens aparecerão aqui automaticamente</p>
                  <p className="text-[11px] text-slate-400 font-medium">Após colar a mensagem e clicar em "Montar Pedido com IA", os itens e valores serão preenchidos.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-white truncate">{item.name}</h5>
                        <span className="text-[10px] text-slate-400 font-medium">
                          R$ {(item.price || 0).toFixed(2).replace('.', ',')} cada
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-extrabold text-xs text-emerald-400 px-1 min-w-[18px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-black text-xs text-white min-w-[50px] text-right">
                          R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Forma de Pagamento */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="font-bold text-slate-300 block text-[11px]">Forma de Pagamento *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'pix'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao_maquininha')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'cartao_maquininha'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cartão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('dinheiro')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'dinheiro'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Dinheiro</span>
                  </button>
                </div>

                {paymentMethod === 'dinheiro' && (
                  <div className="mt-2 bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                    <label className="font-bold text-amber-300 block text-[11px] mb-1">
                      Troco para quanto? (R$)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 100"
                      value={changeFor || ''}
                      onChange={(e) => setChangeFor(Number(e.target.value) || undefined)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-amber-500/40 rounded-lg focus:outline-none font-extrabold text-xs text-amber-200"
                    />
                  </div>
                )}
              </div>

              {/* Taxa de Entrega Chips */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300 text-[11px]">Taxa de Entrega (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                    className="w-20 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-right font-black text-xs text-emerald-400 focus:outline-none"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 7, 8.5, 10, 12, 15].map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() => setDeliveryFee(fee)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                        deliveryFee === fee
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-800'
                      }`}
                    >
                      R$ {fee.toFixed(2).replace('.', ',')}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Bottom Financial Totals & Confirm CTA */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1.5 text-xs shadow-2xs">
                <div className="flex justify-between text-slate-400 font-medium">
                  <span>Subtotal:</span>
                  <span>R$ {(subtotal || 0).toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-slate-400 font-medium">
                  <span>Taxa de Entrega:</span>
                  <span>R$ {(safeDeliveryFee || 0).toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between items-center text-white font-black text-base pt-1.5 border-t border-slate-800">
                  <span>TOTAL:</span>
                  <span className="text-xl text-emerald-400 font-extrabold">
                    R$ {(total || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-bold leading-relaxed">
                  ⚠️ {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!clientName || !address || isSubmitting}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-2xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current text-slate-950" />
                <span>{isSubmitting ? 'Lançando Pedido...' : 'CONFIRMAR E LANÇAR PEDIDO'}</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
