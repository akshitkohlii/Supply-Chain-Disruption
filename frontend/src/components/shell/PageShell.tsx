type PageShellProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  contentClassName?: string;
  headerClassName?: string;
};

export default function PageShell({
  children,
  header,
  contentClassName = "",
  headerClassName = "",
}: PageShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {header ? (
        <div className={`shrink-0 px-4 pb-4 pt-4 md:px-6 ${headerClassName}`}>
          {header}
        </div>
      ) : null}

      <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}