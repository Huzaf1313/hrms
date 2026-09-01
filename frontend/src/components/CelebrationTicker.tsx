import React from "react";

interface Celebration {
  id: number;
  icon: string;
  name: string;
  message: string;
}

const celebrations: Celebration[] = [
  {
    id: 1,
    icon: "🎂",
    name: "Rahul Verma",
    message: "Birthday today!",
  },
  {
    id: 2,
    icon: "🎊",
    name: "Neha Sharma",
    message: "Work Anniversary (5 Years)",
  },
  {
    id: 3,
    icon: "🎂",
    name: "Arjun Patel",
    message: "Birthday tomorrow!",
  },
  {
    id: 4,
    icon: "🎉",
    name: "Priya Singh",
    message: "Work Anniversary (3 Years)",
  },
  {
    id: 5,
    icon: "🎂",
    name: "Amit Shah",
    message: "Birthday today!",
  },
];

const CelebrationTicker: React.FC = () => {
  return (
    <section
      className="mb-6 w-full overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 via-white to-orange-50 shadow-sm"
      aria-label="Employee celebrations"
    >
      <div className="flex h-[72px] items-center">
        {/* Fixed Celebration Label */}
        <div className="relative z-10 flex h-full min-w-[210px] items-center gap-3 border-r border-red-100 bg-gradient-to-r from-red-50 to-red-50 px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
            🎉
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#17375e]">
              Celebrations
            </h3>

            <p className="mt-0.5 text-xs text-gray-500">
              Birthdays &amp; Anniversaries
            </p>
          </div>
        </div>

        {/* Scrolling Area */}
        <div className="relative flex-1 overflow-hidden">
          <div className="celebration-marquee flex w-max items-center">
            {/* First Set */}
            {celebrations.map((celebration) => (
              <React.Fragment key={`first-${celebration.id}`}>
                <div className="flex shrink-0 items-center whitespace-nowrap px-7">
                  <span className="mr-2 text-lg">
                    {celebration.icon}
                  </span>

                  <span className="text-sm font-medium text-[#17375e]">
                    {celebration.name}
                  </span>

                  <span className="mx-2 text-sm text-gray-400">
                    —
                  </span>

                  <span className="text-sm text-gray-600">
                    {celebration.message}
                  </span>
                </div>

                <span className="text-red-300">•</span>
              </React.Fragment>
            ))}

            {/* Duplicate Set for Seamless Infinite Scrolling */}
            {celebrations.map((celebration) => (
              <React.Fragment key={`second-${celebration.id}`}>
                <div className="flex shrink-0 items-center whitespace-nowrap px-7">
                  <span className="mr-2 text-lg">
                    {celebration.icon}
                  </span>

                  <span className="text-sm font-medium text-[#17375e]">
                    {celebration.name}
                  </span>

                  <span className="mx-2 text-sm text-gray-400">
                    —
                  </span>

                  <span className="text-sm text-gray-600">
                    {celebration.message}
                  </span>
                </div>

                <span className="text-red-300">•</span>
              </React.Fragment>
            ))}
          </div>

          {/* Left Fade */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-red-50/90 to-transparent" />

          {/* Right Fade */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-orange-50/90 to-transparent" />
        </div>
      </div>
    </section>
  );
};

export default CelebrationTicker;