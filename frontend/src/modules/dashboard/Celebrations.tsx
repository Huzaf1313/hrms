import type { Celebration } from "./celebrationTypes";

const TYPE_LABELS: Record<Celebration["type"], string> = {
  birthday: "Birthday",
  anniversary: "Work Anniversary",
};

interface CelebrationsProps {
  celebrations: Celebration[];
}

function Celebrations({ celebrations }: CelebrationsProps) {
  return (
    <div className="h-full rounded-[2px] bg-white p-6 shadow-none">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Celebrations
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Birthdays and work anniversaries
        </p>
      </div>

      {celebrations.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <p className="text-sm text-gray-500">
            No celebrations today
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {celebrations.map((celebration) => (
            <div
              key={`${celebration.employee_id}-${celebration.type}`}
              className="rounded-[2px] bg-gray-50 p-4"
            >
              <p className="font-semibold text-gray-800">
                {celebration.name}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {TYPE_LABELS[celebration.type] ?? celebration.type}
              </p>

              {celebration.message && (
                <p className="mt-1 text-sm text-gray-600">
                  {celebration.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Celebrations;