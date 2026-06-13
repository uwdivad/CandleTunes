interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS: { label: string; months: number }[] = [
  { label: "1M", months: 1 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "5Y", months: 60 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const applyPreset = (months: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    onChange(isoDate(startDate), isoDate(endDate));
  };

  return (
    <div className="field-group date-range-picker">
      <label className="field-label">Date range</label>
      <div className="date-range-row">
        <input type="date" value={start} onChange={(e) => onChange(e.target.value, end)} />
        <span>to</span>
        <input type="date" value={end} onChange={(e) => onChange(start, e.target.value)} />
      </div>
      <div className="date-presets">
        {PRESETS.map((p) => (
          <button type="button" key={p.label} onClick={() => applyPreset(p.months)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
