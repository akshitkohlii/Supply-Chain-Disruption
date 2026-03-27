type PageSectionProps = {
  children: React.ReactNode;
  className?: string;
};

export default function PageSection({
  children,
  className = "",
}: PageSectionProps) {
  return <section className={`space-y-6 ${className}`}>{children}</section>;
}