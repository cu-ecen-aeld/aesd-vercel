export default function ErrorPage({ query }) {
  const message = query?.message || 'Repository setup failed.';

  return (
    <main className="container">
      <h1>Repository Setup Error</h1>
      <p>{message}</p>
      <a className="card" href="/">Return to assignments</a>
    </main>
  );
}

export async function getServerSideProps({ query }) {
  return {
    props: { query },
  };
}
