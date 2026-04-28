import type { Account } from '@/lib/types';
import { Select } from '@/components/ui/Select';

interface Props {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
}

export function AccountSelector({ accounts, value, onChange }: Props) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm"
    >
      <option value="">— select account —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label} ({a.kind === 'chequing' ? 'Chequing' : 'Credit card'}{a.isPassThrough ? ', pass-through' : ''})
        </option>
      ))}
    </Select>
  );
}
