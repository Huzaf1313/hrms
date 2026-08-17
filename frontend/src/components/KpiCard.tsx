type KpiCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: string;
  iconBg: string;
  children?: React.ReactNode;
};

function KpiCard({
  title,
  value,
  description,
  icon,
  iconBg,
  children,
}: KpiCardProps) {
  return (
    <div className="relative h-[210px] rounded-[28px] bg-white p-7 shadow-sm">
      {/* Title */}
      <p className="text-sm font-medium tracking-wide text-gray-700">
        {title}
      </p>

      {/* Icon */}
      <div
        className={`absolute right-7 top-7 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}
      >
        <span className="text-xl">{icon}</span>
      </div>

      {/* Value */}
      <p className="mt-7 text-6xl font-semibold tracking-tight text-[#171b1d]">
        {value}
      </p>

      {/* Bottom content */}
      <div className="mt-6">
        {description && (
          <p className="text-sm font-medium text-[#456b54]">
            {description}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}

export default KpiCard;