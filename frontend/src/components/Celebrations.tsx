const celebrations = [
  {
    name: "Alex Mercer",
    event: "Birthday Today",
    initials: "AM",
  },
  {
    name: "Maya Lin",
    event: "3 Year Anniversary",
    initials: "ML",
  },
  {
    name: "James Doe",
    event: "Birthday Tomorrow",
    initials: "JD",
  },
];

function Celebrations() {
  return (
    <section className="rounded-[28px] bg-white p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
          <span className="text-xl">♨</span>
        </div>

        <h2 className="text-2xl font-semibold text-[#171b1d]">
          Celebrations
        </h2>
      </div>

      {/* People */}
      <div className="mt-7 space-y-4">
        {celebrations.map((person) => (
          <div
            key={person.name}
            className="flex items-center gap-4 rounded-2xl bg-[#f7f9f8] p-4"
          >
            {/* Avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#dce5df] text-sm font-semibold text-[#456b54]">
              {person.initials}
            </div>

            {/* Information */}
            <div>
              <p className="font-semibold text-[#171b1d]">
                {person.name}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {person.event}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* View all */}
      <button className="mt-7 w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
        View All
      </button>
    </section>
  );
}

export default Celebrations;