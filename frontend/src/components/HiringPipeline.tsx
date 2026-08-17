const hiringStages = [
  "Applied",
  "Screened",
  "Interview",
  "Offered",
];

function HiringPipeline() {
  return (
    <section className="h-[280px] rounded-[28px] bg-white p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <span className="text-xl text-[#456b54]">♙</span>
          </div>

          <h2 className="text-2xl font-semibold text-[#171b1d]">
            Hiring Pipeline
          </h2>
        </div>

        <button className="flex items-center gap-3 rounded-xl bg-[#f7f9f8] px-4 py-3 text-sm font-medium text-gray-700">
          Q3 2024
          <span>⌄</span>
        </button>
      </div>

      {/* Pipeline stages */}
      <div className="mt-[155px] grid grid-cols-4">
        {hiringStages.map((stage) => (
          <p
            key={stage}
            className="text-center text-sm font-medium text-gray-700"
          >
            {stage}
          </p>
        ))}
      </div>
    </section>
  );
}

export default HiringPipeline;