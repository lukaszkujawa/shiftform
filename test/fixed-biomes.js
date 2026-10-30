export const fixedBiomes = entries => {
  const levels = new Map(entries);
  return want => levels.get(want.index) ?? null;
};
