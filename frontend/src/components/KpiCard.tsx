type KpiCardProps = {
  title: string;
  value: string;
  description?: React.ReactNode;
  icon: React.ReactNode;
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
        {icon}
      </div>

      {/* Value */}
      <p className="mt-7 text-6xl font-semibold tracking-tight text-[#171b1d]">
        {value}
      </p>

      {/* Bottom content */}
      <div className="mt-6">
        {description && (
          <div className="text-sm font-medium text-[#456b54]">
            {description}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export default KpiCard;