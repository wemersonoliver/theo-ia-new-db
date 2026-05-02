/**
 * Sanitiza um nome de departamento em um slug seguro para nomes técnicos
 * de instância na Evolution API. Resultado: lowercase, somente [a-z0-9],
 * truncado em 20 chars.
 */
export function slugifyDepartment(name: string): string {
  if (!name) return "";
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return normalized;
}

/**
 * Monta o instance_name padronizado: biz<businessCode>_<slug>
 */
export function buildInstanceName(businessCode: number | null | undefined, slug: string): string {
  const code = businessCode ?? 0;
  return `biz${code}_${slug}`;
}