import { describe, it, expect, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { deleteGeneratedPost } from "./index";

const post = {
  id: "post-1",
  profile_id: "user-1",
  status: "published",
  day_number: 3,
};

function fluentBuilder(config: {
  maybeSingleData: unknown;
  deleteResult: { error: unknown };
}) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: config.maybeSingleData, error: null }),
    single: vi.fn().mockResolvedValue({ data: config.maybeSingleData, error: null }),
  };
  builder.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(config.deleteResult),
    }),
  });
  return builder as never;
}

function makeClient({ asset }: { asset: { id: string; storage_path: string } | null }) {
  const storageRemove = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "generated_posts") {
      return fluentBuilder({ maybeSingleData: post, deleteResult: { error: null } });
    }
    if (table === "media_assets") {
      return fluentBuilder({ maybeSingleData: asset, deleteResult: { error: null } });
    }
    return fluentBuilder({ maybeSingleData: null, deleteResult: { error: null } });
  });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from,
    storage: { from: vi.fn().mockReturnValue({ remove: storageRemove }) },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("deleteGeneratedPost", () => {
  it("allows deleting a published post (frees the day for regeneration)", async () => {
    const client = makeClient({ asset: { id: "asset-1", storage_path: "user-1/post-1/image.svg" } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    // Previously threw INVALID_STATUS for published posts; now it must resolve.
    await expect(deleteGeneratedPost("post-1")).resolves.toBeUndefined();
    expect(client.storage.from).toHaveBeenCalled();
  });

  it("deletes without error when the post has no media asset", async () => {
    const client = makeClient({ asset: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(deleteGeneratedPost("post-1")).resolves.toBeUndefined();
    expect(client.from).toHaveBeenCalledWith("generated_posts");
  });
});
