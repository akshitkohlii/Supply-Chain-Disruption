
type BlankChartProps = {
  h: string;
};

export default function BlankChart({ h }: BlankChartProps) {
  return (
    <div
      className={`${h} rounded-2xl border border-dashed border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(2,6,23,0.35))]`}
    />
  );
}
