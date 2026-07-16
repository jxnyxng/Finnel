export function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <article className="glass-subcard rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
    </article>
  );
}
