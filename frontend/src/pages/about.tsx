import { useState } from 'react';
import { departments, type Department } from '@/data/officers';
import OfficerCard from '@/components/OfficerCard';

export default function About() {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="mb-8 text-3xl font-bold">About Us</h1>

      {!selectedDept && (
        <>
          <div className="mx-auto mb-12 w-fit rounded-xl border-8 border-red-700 p-2">
            <img
              src="/mockAboutPhoto.webp"
              alt="CougarAI Team"
              className="h-auto w-full rounded-lg"
            />
          </div>

          <p className="mx-auto mb-12 max-w-2xl text-lg">
            We are your #1 organization at the University of Houston for students wanting to learn more about AI.
            Anyone is welcome to join—we encourage all to explore the rapidly evolving field of AI/ML.
          </p>

          <h2 className="mb-6 text-2xl font-bold">Our Officers</h2>

          {/* Keep the panel narrow like other pages */}
          <section className="mx-auto w-full rounded-xl bg-red-700/90 px-6 py-8">
            <h3 className="mb-5 text-lg font-bold text-white">Select Department</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  className="rounded bg-white px-5 py-6 font-semibold text-black shadow transition hover:bg-gray-200"
                  onClick={() => setSelectedDept(dept)}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {selectedDept && (
        <section className="mx-auto w-full rounded-xl bg-red-700/90 p-6">
          <h2 className="mb-4 text-2xl font-bold text-white">{selectedDept.name}</h2>
          <div className="grid grid-cols-1 gap-6">
            {selectedDept.officers.map((officer) => (
              <OfficerCard key={officer.id} officer={officer} />
            ))}
          </div>
          <button
            className="mt-8 rounded bg-red-700 px-6 py-2 font-bold text-white hover:bg-red-800"
            onClick={() => setSelectedDept(null)}
          >
            Back to Departments
          </button>
        </section>
      )}
    </div>
  );
}
