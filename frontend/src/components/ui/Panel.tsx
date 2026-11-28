import React from "react";

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className = "",
  title,
  actions,
  ...props
}) => {
  return (
    <div
      className={`rounded-[2px] bg-white border border-[#E4E6E1] p-[16px_20px] shadow-none ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#E4E6E1]">
          {title && (
            <div>
              {typeof title === "string" ? (
                <h3 className="text-[14px] font-semibold text-[#1F2933]">{title}</h3>
              ) : (
                title
              )}
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Panel;
