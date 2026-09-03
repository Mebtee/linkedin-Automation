import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { GeneratedPostRow } from "@/types/generated-post";
import type {
  ImageGenerationInput,
  ImageProviderResult,
  MediaAssetRow,
  CreateMediaAssetInput,
  ImageTemplate,
} from "@/types/image";
import { brand } from "@/config/brand";
import { getImageGenerationProvider } from "./index";
import { validateImageInput } from "./validation";
import { selectTemplate } from "./svg/template-selector";
import { buildVisualBrief } from "./visual/brief";

// ─── Image Generation Service ───────────────────────────────────────────────
// Orchestrates image generation, storage, and persistence.
// Business logic lives here — Server Actions remain thin.

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "IMAGE_UNAUTHORIZED" });
  }

  return user;
}

async function loadOwnPost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  postId: string,
): Promise<GeneratedPostRow> {
  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("id", postId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Generated post not found.", { code: "POST_NOT_FOUND" });
  }

  return data as GeneratedPostRow;
}

async function loadExistingAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  postId: string,
): Promise<MediaAssetRow | null> {
  const { data } = await supabase
    .from("media_assets")
    .select("*")
    .eq("generated_post_id", postId)
    .eq("profile_id", userId)
    .single();

  return (data as MediaAssetRow) ?? null;
}

async function loadCurriculumDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayNumber: number,
): Promise<{ topic: string; module_id: string }> {
  const { data, error } = await supabase
    .from("curriculum_days")
    .select("topic, module_id")
    .eq("day_number", dayNumber)
    .single();

  if (error || !data) {
    throw new AppError("Curriculum day not found.", { code: "CURRICULUM_NOT_FOUND" });
  }

  return data;
}

async function loadModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
): Promise<{ module_number: number; title: string }> {
  const { data, error } = await supabase
    .from("modules")
    .select("module_number, title")
    .eq("id", moduleId)
    .single();

  if (error || !data) {
    throw new AppError("Module not found.", { code: "CURRICULUM_NOT_FOUND" });
  }

  return data;
}

// ─── Build Image Input ──────────────────────────────────────────────────────

async function loadPostType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opportunityId: string | null,
): Promise<string | null> {
  if (!opportunityId) return null;
  const { data, error } = await supabase
    .from("content_opportunities")
    .select("post_type")
    .eq("id", opportunityId)
    .single();
  if (error || !data) return null;
  return (data as { post_type: string }).post_type;
}

async function buildImageInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  post: GeneratedPostRow,
  curriculum: { topic: string; moduleNumber: number; moduleTitle: string },
): Promise<ImageGenerationInput> {
  const template = selectTemplate({
    explicitTemplate: post.image_template,
    dayNumber: post.day_number,
    topic: curriculum.topic,
    format: post.format,
  });

  const postType = await loadPostType(supabase, post.opportunity_id);

  const visualBrief = buildVisualBrief({
    post,
    topic: curriculum.topic,
    moduleNumber: curriculum.moduleNumber,
    moduleTitle: curriculum.moduleTitle,
    postType,
  });

  return {
    dayNumber: post.day_number,
    topic: curriculum.topic,
    moduleNumber: curriculum.moduleNumber,
    moduleTitle: curriculum.moduleTitle,
    headline: post.image_headline || curriculum.topic,
    subheadline: post.image_subheadline || "",
    keywords: post.image_keywords ?? [],
    visualConcept: post.image_visual_concept || "",
    template,
    visualBrief,
  };
}

// ─── Generate Alt Text ──────────────────────────────────────────────────────

function generateAltText(dayNumber: number, topic: string): string {
  return `Day ${dayNumber} of ${brand.series}: ${topic}`;
}

// ─── Main Service Functions ─────────────────────────────────────────────────

/**
 * Generates a branded image for a generated post.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Load post + curriculum
 * 3. Build image input
 * 4. Generate SVG via provider
 * 5. Store in Supabase Storage
 * 6. Persist metadata in media_assets
 * 7. Return asset
 */
export async function generatePostImage(
  postId: string,
  requestedProvider?: "gemini-image" | "branded-svg",
  requestedTemplate?: ImageTemplate,
): Promise<MediaAssetRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  // Load post
  const post = await loadOwnPost(supabase, user.id, postId);

  // Load curriculum context
  const curriculumDay = await loadCurriculumDay(supabase, post.day_number);
  const moduleData = await loadModule(supabase, curriculumDay.module_id);

  // Build input
  const input = await buildImageInput(supabase, post, {
    topic: curriculumDay.topic,
    moduleNumber: moduleData.module_number,
    moduleTitle: moduleData.title,
  });

  // Override template if requested
  const finalInput: ImageGenerationInput = requestedTemplate
    ? { ...input, template: requestedTemplate }
    : input;

  // Validate input
  const validatedInput = validateImageInput(finalInput);

  // Generate image via the active (or overridden) provider
  const provider = await getImageGenerationProvider(requestedProvider);
  let result: ImageProviderResult;
  try {
    result = await provider.generateImage(validatedInput);
  } catch (err) {
    throw new AppError(
      `Image generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      { code: "IMAGE_GENERATION_FAILED", cause: err },
    );
  }

  // Delete existing asset if present
  const existing = await loadExistingAsset(supabase, user.id, postId);
  if (existing) {
    await supabase.storage.from("post-images").remove([existing.storage_path]);
    await supabase.from("media_assets").delete().eq("id", existing.id);
  }

  // Determine output format from the provider result (SVG or raster PNG).
  const isPng = result.mimeType === "image/png";
  const svgText = result.svg ?? "";
  if (!isPng && svgText.length === 0) {
    throw new AppError("Image provider returned no SVG content.", {
      code: "IMAGE_GENERATION_FAILED",
    });
  }
  if (isPng && (!result.png || result.png.byteLength === 0)) {
    throw new AppError("Image provider returned no image bytes.", {
      code: "IMAGE_GENERATION_FAILED",
    });
  }

  // Upload to Supabase Storage. SVG is uploaded as a string (matching the legacy
  // path); PNG is uploaded as raw bytes.
  const ext = isPng ? "png" : "svg";
  const storagePath = `${user.id}/${postId}/image.${ext}`;
  const uploadBody: string | Uint8Array = isPng ? result.png! : svgText;
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(storagePath, uploadBody, {
      contentType: result.mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new AppError("Failed to upload image to storage.", {
      code: "IMAGE_STORAGE_FAILED",
      cause: uploadError,
    });
  }

  // The bucket is private — images are served to their owner through the
  // authenticated route, which authorizes via RLS-checked media_assets.
  const storageUrl = `/api/media/${postId}/image`;

  // Persist metadata
  const altText = generateAltText(post.day_number, curriculumDay.topic);
  const createInput: CreateMediaAssetInput = {
    generated_post_id: postId,
    storage_path: storagePath,
    storage_url: storageUrl,
    mime_type: result.mimeType,
    width: result.width,
    height: result.height,
    template: result.template,
    alt_text: altText,
    metadata: {
      topic: curriculumDay.topic,
      moduleNumber: moduleData.module_number,
      moduleTitle: moduleData.title,
    },
  };

  const { data: assetData, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      profile_id: user.id,
      generated_post_id: createInput.generated_post_id,
      storage_path: createInput.storage_path,
      storage_url: createInput.storage_url,
      mime_type: createInput.mime_type,
      width: createInput.width,
      height: createInput.height,
      template: createInput.template,
      alt_text: createInput.alt_text,
      metadata: createInput.metadata ?? null,
    })
    .select()
    .single();

  if (insertError) {
    throw new AppError("Failed to save image metadata.", {
      code: "IMAGE_STORAGE_FAILED",
      cause: insertError,
    });
  }

  return assetData as MediaAssetRow;
}

/**
 * Gets the media asset for a generated post.
 * Returns null if no image has been generated.
 */
export async function getPostImage(
  postId: string,
): Promise<MediaAssetRow | null> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("media_assets")
    .select("*")
    .eq("generated_post_id", postId)
    .eq("profile_id", userId)
    .single();

  return (data as MediaAssetRow) ?? null;
}

/**
 * Regenerates an image for a post with an optional template override.
 * Preserves the post text. Replaces the existing media asset.
 */
export async function regeneratePostImage(
  postId: string,
  template?: ImageTemplate,
  provider?: "gemini-image" | "branded-svg",
): Promise<MediaAssetRow> {
  return generatePostImage(postId, provider, template);
}
