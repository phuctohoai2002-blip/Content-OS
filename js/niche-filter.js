import { supabase } from "./supabase.js";

export async function resolveNicheId(nicheCode = "ALL") {
    if (!nicheCode || nicheCode === "ALL") return null;

    const { data, error } = await supabase
        .from("niches")
        .select("id")
        .eq("niche_code", nicheCode)
        .eq("status", "active")
        .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
}

export function applyNicheFilter(query, nicheId = null) {
    return nicheId ? query.eq("niche_id", nicheId) : query;
}

export async function fetchByCurrentNiche(
    table,
    select = "*",
    nicheId = null,
    orderColumn = "created_at",
    ascending = false
) {
    let query = supabase.from(table).select(select);
    query = applyNicheFilter(query, nicheId);

    if (orderColumn) {
        query = query.order(orderColumn, { ascending });
    }

    return query;
}
