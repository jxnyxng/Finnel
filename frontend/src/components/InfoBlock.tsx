export function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-md border border-zinc-100 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </article>
  );
}
