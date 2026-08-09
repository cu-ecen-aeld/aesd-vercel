const assignments = [
  { id: 1, label: 'Assignment 1', slug: 'assignment-1' },
  { id: 2, label: 'Assignment 2', slug: 'assignment-2' },
  { id: 3, label: 'Assignment 3', slug: 'assignment-3' },
  { id: 4, label: 'Assignment 4', slug: 'assignment-4' },
  { id: 5, label: 'Assignment 5', slug: 'assignment-5' },
  { id: 6, label: 'Assignment 6', slug: 'assignment-6' },
  { id: 7, label: 'Assignment 7', slug: 'assignment-7' },
  { id: 8, label: 'Assignment 8', slug: 'assignment-8' },
  { id: 9, label: 'Assignment 9', slug: 'assignment-9' },
  { id: 10, label: 'Final Project', slug: 'final-project' },
];

export default function Home() {
  return (
    <main className="container">
      <h1>AESD Repository Setup</h1>
      <p>Select an assignment to create your repository in the GitHub organization.</p>

      <div className="grid">
        {assignments.map((assignment) => (
          <a
            key={assignment.id}
            className="card"
            href={`/api/create-repo?assignment=${assignment.slug}`}
          >
            <span>{assignment.label}</span>
            <strong>Open with GitHub</strong>
          </a>
        ))}
      </div>
    </main>
  );
}
