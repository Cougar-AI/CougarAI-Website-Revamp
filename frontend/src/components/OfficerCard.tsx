import type { Officer } from '@/data/officers';

export default function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <div className="bg-gray-100 text-black p-4 rounded shadow">
      <img
        src={officer.photo}
        alt={officer.name}
        className="mx-auto mb-4 h-32 w-32 rounded-full object-cover"
        loading="lazy"
      />
      <h3 className="text-xl font-semibold">{officer.name}</h3>
      <p className="mb-2">{officer.position}</p>
      <a
        href={officer.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline underline-offset-2"
      >
        LinkedIn
      </a>
    </div>
  );
}
