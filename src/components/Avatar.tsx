// Black & white theme: deterministic grayscale shades instead of colored
// gradients -- same hash-based variety per user (so avatars still look
// distinct from each other), just without hue.
const GRADIENTS = [
  ["#171717", "#000000"],
  ["#404040", "#171717"],
  ["#262626", "#0a0a0a"],
  ["#525252", "#262626"],
];

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export default function Avatar({
  seed,
  name,
  size = 40,
}: {
  seed: string;
  name: string;
  size?: number;
}) {
  const idx = hashSeed(seed) % GRADIENTS.length;
  const [from, to] = GRADIENTS[idx];
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.4,
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
