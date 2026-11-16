// The index tabs' logic, kept free of React: which section a page belongs to and which page a tab opens.
// A section is { label, ids }; its tab opens the last page you used in it (if it still belongs), else its first page.
export const sectionOf = (sections, page) => sections.find((s) => s.ids.includes(page));

export function tabTarget(sections, section, last) {
  const id = last?.[section.label];
  return section.ids.includes(id) ? id : section.ids[0];
}
