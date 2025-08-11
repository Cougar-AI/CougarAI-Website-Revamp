export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you’re looking for doesn’t exist.
      </p>
      <a href="/" className="mt-6 inline-block rounded bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800">
        Go home
      </a>
    </div>
  );
}