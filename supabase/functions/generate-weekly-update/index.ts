import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  ImageRun,
  HeadingLevel,
} from "https://esm.sh/docx@8.5.0";
import {
  BRAND,
  STATUS_SUMMARY_OPENER,
  WEEKLY_ESCALATION_ROWS,
} from "../_shared/brandConstants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const border = (color = BRAND.colors.border, size = 4) => ({
  style: BorderStyle.SINGLE,
  size,
  color,
});
const allBorders = () => ({
  top: border(),
  bottom: border(),
  left: border(),
  right: border(),
});

function cellText(text: string, opts: { bold?: boolean; color?: string; fill?: string; width?: number } = {}) {
  return new TableCell({
    borders: allBorders(),
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            color: opts.color ?? BRAND.colors.gray,
            size: BRAND.sizes.body,
            font: BRAND.font,
          }),
        ],
      }),
    ],
  });
}

async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    const url = new URL("../../../public/assets/cc-monogram.png", import.meta.url);
    return await Deno.readFile(url);
  } catch {
    return null;
  }
}

function buildWeeklyDocx(params: {
  clientName: string;
  campaign: string;
  ftcNumber: string | null;
  statusSummary: string;
  letterRows: { num: number; recipient: string; action: string }[];
  recipientNames: string[];
  logoBytes: Uint8Array | null;
}): Document {
  const children: (Paragraph | Table)[] = [];

  if (params.logoBytes) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: params.logoBytes,
            transformation: { width: 80, height: 80 },
            type: "png",
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: BRAND.name,
          bold: true,
          size: BRAND.sizes.brand,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: BRAND.tagline,
          italics: true,
          size: BRAND.sizes.subtitle,
          color: BRAND.colors.gray,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND.colors.accent, space: 1 } },
      children: [new TextRun({ text: " ", size: 2 })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Weekly Client Update",
          bold: true,
          size: BRAND.sizes.h1,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Client: ", bold: true, size: BRAND.sizes.client, font: BRAND.font }),
        new TextRun({ text: params.clientName, bold: true, size: BRAND.sizes.client, font: BRAND.font }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Re: ${params.campaign}${params.ftcNumber ? ` — FTC Identity Theft Report #${params.ftcNumber}` : ""}`,
          size: BRAND.sizes.body,
          color: BRAND.colors.gray,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({
          text: "Status Summary",
          bold: true,
          size: BRAND.sizes.h2,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: params.statusSummary, size: BRAND.sizes.body, font: BRAND.font }),
      ],
    }),
    new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({
          text: "Letters & Actions Executed Thus Far",
          bold: true,
          size: BRAND.sizes.h2,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "The following correspondence and actions have been completed on your file:",
          size: BRAND.sizes.body,
          font: BRAND.font,
        }),
      ],
    }),
  );

  const letterTableRows = [
    new TableRow({
      children: [
        cellText("#", { bold: true, color: BRAND.colors.white, fill: BRAND.colors.navy, width: 720 }),
        cellText("Recipient", { bold: true, color: BRAND.colors.white, fill: BRAND.colors.navy, width: 2880 }),
        cellText("Letter / Action", { bold: true, color: BRAND.colors.white, fill: BRAND.colors.navy, width: 5760 }),
      ],
    }),
    ...params.letterRows.map((row, i) =>
      new TableRow({
        children: [
          cellText(String(row.num), { fill: i % 2 === 0 ? BRAND.colors.tableAlt : BRAND.colors.white, width: 720 }),
          cellText(row.recipient, { fill: i % 2 === 0 ? BRAND.colors.tableAlt : BRAND.colors.white, width: 2880 }),
          cellText(row.action, { fill: i % 2 === 0 ? BRAND.colors.tableAlt : BRAND.colors.white, width: 5760 }),
        ],
      })
    ),
  ];

  children.push(
    new Table({
      width: { size: BRAND.tableWidth, type: WidthType.DXA },
      rows: letterTableRows,
    }),
  );

  children.push(
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: "Next Step — Escalation Plan",
          bold: true,
          size: BRAND.sizes.h2,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Status: Monitoring response window", size: BRAND.sizes.body, font: BRAND.font }),
      ],
    }),
  );

  const escalationRows = [
    new TableRow({
      children: [
        cellText("Step", { bold: true, color: BRAND.colors.white, fill: BRAND.colors.navy, width: 3120 }),
        cellText("Action", { bold: true, color: BRAND.colors.white, fill: BRAND.colors.navy, width: 6240 }),
      ],
    }),
    ...WEEKLY_ESCALATION_ROWS.map((row, i) =>
      new TableRow({
        children: [
          cellText(row.step, { bold: true, fill: i % 2 === 0 ? BRAND.colors.tableAlt : BRAND.colors.white, width: 3120 }),
          cellText(row.action, { fill: i % 2 === 0 ? BRAND.colors.tableAlt : BRAND.colors.white, width: 6240 }),
        ],
      })
    ),
  ];

  children.push(
    new Table({
      width: { size: BRAND.tableWidth, type: WidthType.DXA },
      rows: escalationRows,
    }),
  );

  const bulletItems = [
    "We are actively disputing inaccurate and unverifiable items on your credit reports.",
    `Correspondence has been sent to: ${params.recipientNames.join(", ") || "bureaus and furnishers on your file"}.`,
    "You do not need to contact the bureaus or furnishers directly — we handle all follow-up.",
    "We will notify you when substantive responses are received or when the next escalation step is required.",
  ];

  children.push(
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: "What This Means For You",
          bold: true,
          size: BRAND.sizes.h2,
          color: BRAND.colors.navy,
          font: BRAND.font,
        }),
      ],
    }),
    ...bulletItems.map(
      (item) =>
        new Paragraph({
          spacing: { after: 60 },
          bullet: { level: 0 },
          children: [new TextRun({ text: item, size: BRAND.sizes.body, font: BRAND.font })],
        }),
    ),
  );

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: BRAND.page.width, height: BRAND.page.height },
          margin: {
            top: BRAND.page.marginTop,
            bottom: BRAND.page.marginBottom,
            left: BRAND.page.marginLeft,
            right: BRAND.page.marginRight,
            header: BRAND.page.header,
            footer: BRAND.page.footer,
          },
        },
      },
      children,
    }],
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const clientId = body.client_id as string;
    const roundId = body.round_id as string | undefined;
    const includeDates = body.include_dates_in_body === true;
    const customSummary = body.custom_status_summary as string | undefined;

    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("legal_name, legal_full_name, campaign_label, ftc_identity_theft_report_number, preferred_name")
      .eq("id", clientId)
      .single();

    let resolvedRoundId = roundId;
    if (!resolvedRoundId) {
      const { data: latestRound } = await supabase
        .from("dispute_rounds")
        .select("id, round_number")
        .eq("client_id", clientId)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedRoundId = latestRound?.id;
    }

    let lettersQuery = supabase
      .from("dispute_letters")
      .select("recipient_name, letter_type, body_md, statutes")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (resolvedRoundId) {
      lettersQuery = lettersQuery.eq("round_id", resolvedRoundId);
    }

    const { data: letters } = await lettersQuery;

    let eventsQuery = supabase
      .from("timeline_events")
      .select("title, summary, details, source, category")
      .eq("client_id", clientId)
      .eq("event_kind", "action")
      .order("event_date", { ascending: true });

    if (resolvedRoundId) {
      eventsQuery = eventsQuery.eq("round_id", resolvedRoundId);
    }

    const { data: events } = await eventsQuery;

    const letterRows: { num: number; recipient: string; action: string }[] = [];
    let rowNum = 1;

    for (const letter of letters ?? []) {
      const statutes = (letter.statutes as string[])?.slice(0, 3).join("; ") ?? "";
      letterRows.push({
        num: rowNum++,
        recipient: letter.recipient_name as string,
        action: `${letter.letter_type as string}${statutes ? ` (${statutes})` : ""}`,
      });
    }

    for (const ev of events ?? []) {
      if (letters?.some((l) => l.letter_type === ev.title)) continue;
      letterRows.push({
        num: rowNum++,
        recipient: (ev.source as string) ?? "Other",
        action: (ev.summary as string) ?? (ev.title as string),
      });
    }

    const recipientNames = [...new Set(letterRows.map((r) => r.recipient))];

    let statusSummary = customSummary?.trim() || STATUS_SUMMARY_OPENER;
    if (!includeDates) {
      statusSummary = statusSummary.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[date withheld]");
      statusSummary = statusSummary.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[date withheld]");
    }

    const clientName = (client?.legal_full_name ?? client?.legal_name ?? "Client") as string;
    const logoBytes = await loadLogoBytes();
    const doc = buildWeeklyDocx({
      clientName,
      campaign: (client?.campaign_label as string) ?? "Credit Restoration",
      ftcNumber: client?.ftc_identity_theft_report_number as string | null,
      statusSummary,
      letterRows,
      recipientNames,
      logoBytes,
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `Weekly_Update_${clientName.replace(/\s+/g, "_")}.docx`;
    const storagePath = `client-deliverables/${clientId}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("client-deliverables")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadErr) {
      console.warn("Storage upload failed:", uploadErr.message);
    }

    const { data: rendering, error: renderErr } = await supabase
      .from("weekly_update_renderings")
      .insert({
        client_id: clientId,
        round_id: resolvedRoundId ?? null,
        generated_by_user_id: user.id,
        include_dates_in_body: includeDates,
        custom_status_summary: customSummary ?? null,
        output_storage_path: storagePath,
        letters_action_table_snapshot: letterRows,
      })
      .select()
      .single();

    if (renderErr) throw renderErr;

    await supabase.from("timeline_events").insert({
      client_id: clientId,
      round_id: resolvedRoundId ?? null,
      category: "Action",
      event_kind: "action",
      source: "Other",
      title: "Weekly Client Update Generated",
      summary: `Weekly client update generated${resolvedRoundId ? " for selected round" : ""}`,
      details: storagePath,
      raw_line: "[Auto-generated weekly update]",
      event_date: new Date().toISOString().slice(0, 10),
    });

    let downloadUrl: string | null = null;
    if (!uploadErr) {
      const { data: signed } = await supabase.storage
        .from("client-deliverables")
        .createSignedUrl(storagePath, 3600);
      downloadUrl = signed?.signedUrl ?? null;
    }

    return new Response(
      JSON.stringify({
        rendering_id: rendering.id,
        storage_path: storagePath,
        download_url: downloadUrl,
        file_name: fileName,
        buffer_base64: uploadErr ? btoa(String.fromCharCode(...buffer)) : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
