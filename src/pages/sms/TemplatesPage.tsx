import { useMemo, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Save,
  FileText,
  ArrowLeft,
  Copy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import {
  useSms,
  estimateParts,
  isUnicode,
  TEMPLATE_VARIABLES,
  type SmsTemplate,
  type TemplateCategory,
} from '@/stores/sms';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  sale: 'Sale',
  payment: 'Payment',
  reminder: 'Reminder',
  promotion: 'Promotion',
  greeting: 'Greeting',
  other: 'Other',
};

const CATEGORY_TONE: Record<TemplateCategory, 'default' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
  sale: 'success',
  payment: 'info',
  reminder: 'warning',
  promotion: 'destructive',
  greeting: 'info',
  other: 'default',
};

export default function TemplatesPage() {
  const templates = useSms((s) => s.templates);
  const add = useSms((s) => s.addTemplate);
  const update = useSms((s) => s.updateTemplate);
  const remove = useSms((s) => s.removeTemplate);

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | ''>('');
  const [editing, setEditing] = useState<SmsTemplate | 'new' | null>(null);

  const list = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (!q) return true;
      const t2 = q.toLowerCase();
      return `${t.name} ${t.body}`.toLowerCase().includes(t2);
    });
  }, [templates, q, categoryFilter]);

  return (
    <div>
      <PageHeader
        title="SMS Templates"
        subtitle={`${templates.length} templates · variables auto-replaced on send`}
        actions={
          <>
            <Link
              to="/sms"
              className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> SMS
            </Link>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add Template
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-5xl space-y-4">
        <Card className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or body…"
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | '')}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABEL) as TemplateCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Card>

        {list.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <FileText className="size-6 mx-auto mb-2 opacity-50" />
            No templates match.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((t) => {
              const unicode = isUnicode(t.body);
              const parts = estimateParts(t.body, unicode);
              return (
                <Card key={t.id} className="p-4 hover:border-primary transition group">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{t.name}</span>
                        <Badge variant={CATEGORY_TONE[t.category]}>
                          {CATEGORY_LABEL[t.category]}
                        </Badge>
                        {t.language === 'bn' && <Badge variant="outline">বাংলা</Badge>}
                        {!t.active && <Badge variant="default">Inactive</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t.body.length} chars · {parts} part{parts === 1 ? '' : 's'} ·{' '}
                        {unicode ? 'Unicode' : 'GSM-7'}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100">
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(t.body);
                          toast.success('Template body copied');
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                        title="Copy"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `Delete template "${t.name}"?`,
                              variant: 'destructive',
                            })
                          )
                            remove(t.id);
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md bg-muted p-2.5 text-sm whitespace-pre-wrap">
                    {t.body}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-xl"
        title={editing === 'new' ? 'Add Template' : 'Edit Template'}
      >
        {editing && (
          <TemplateForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(data) => {
              if (editing === 'new') add(data);
              else update(editing.id, data);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SmsTemplate;
  onSave: (data: Omit<SmsTemplate, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [category, setCategory] = useState<TemplateCategory>(initial?.category ?? 'other');
  const [language, setLanguage] = useState<'en' | 'bn'>(initial?.language ?? 'en');
  const [active, setActive] = useState(initial?.active ?? true);

  const unicode = isUnicode(body);
  const parts = estimateParts(body, unicode);

  const submit = () => {
    if (!name.trim() || !body.trim()) return;
    onSave({ name: name.trim(), body: body.trim(), category, language, active });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thank you (Sale)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="sale">Sale</option>
              <option value="payment">Payment</option>
              <option value="reminder">Reminder</option>
              <option value="promotion">Promotion</option>
              <option value="greeting">Greeting</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'bn')}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            Body <span className="text-destructive">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Use {variables} for personalization."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
          <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
            <span>{body.length} chars</span>
            <span>
              {parts} part{parts === 1 ? '' : 's'} · {unicode ? 'Unicode (70/part)' : 'GSM-7 (160/part)'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[11px] text-muted-foreground">Insert:</span>
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() =>
                  setBody((b) => b + (b.endsWith(' ') || b.length === 0 ? '' : ' ') + v)
                }
                className="px-2 h-6 rounded border border-border hover:bg-secondary text-[11px] font-mono"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (shown in template picker)
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || !body.trim()}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Template'}
        </Button>
      </div>
    </form>
  );
}
