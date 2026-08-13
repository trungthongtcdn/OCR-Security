import { beforeEach, describe, expect, it } from "vitest";
import { ThreadType, type Message } from "zca-js";
import { CompanyRepo } from "../src/db/companyRepo.js";
import { ensureCompanyConfig, openDatabase, type DB } from "../src/db/database.js";
import { EmployeeRepo } from "../src/db/employeeRepo.js";
import { GroupCandidateRepo } from "../src/db/groupCandidateRepo.js";
import { UsageRepo } from "../src/db/usageRepo.js";
import type { ServiceRegistry } from "../src/runtime/serviceRegistry.js";
import { QuotaService } from "../src/quota/quotaService.js";
import { MessageRouter } from "../src/zalo/messageRouter.js";
import type { ZaloSessionManager } from "../src/zalo/zaloSession.js";

function fakeTextMessage(uidFrom: string, dName: string, content: string): Message {
  return {
    type: ThreadType.User,
    threadId: uidFrom,
    isSelf: false,
    data: { uidFrom, dName, content } as Message["data"],
  } as Message;
}

describe("MessageRouter (text commands)", () => {
  let db: DB;
  let router: MessageRouter;
  let replies: string[];
  let employeeRepo: EmployeeRepo;
  let companyRepo: CompanyRepo;

  const ADMIN_ID = "admin-1";
  const NVKD_ID = "nvkd-1";

  beforeEach(() => {
    db = openDatabase(":memory:");
    ensureCompanyConfig(db, 100);
    employeeRepo = new EmployeeRepo(db);
    companyRepo = new CompanyRepo(db);
    const quotaService = new QuotaService(employeeRepo, new UsageRepo(db), companyRepo, () => 10);

    employeeRepo.upsertManual({ zaloId: ADMIN_ID, name: "Admin", monthlyQuota: 999999, isAdmin: true });

    replies = [];
    const fakeZaloSession = {
      reply: async (_threadId: string, _type: ThreadType, text: string) => {
        replies.push(text);
      },
    } as unknown as ZaloSessionManager;

    const fakeServiceRegistry = {} as ServiceRegistry;

    router = new MessageRouter(
      fakeZaloSession,
      quotaService,
      employeeRepo,
      companyRepo,
      fakeServiceRegistry,
      new GroupCandidateRepo(db),
    );
  });

  it("registers a new NVKD and replies with quota status on 'han muc'", async () => {
    await router.handle(fakeTextMessage(NVKD_ID, "Nguyen Van A", "han muc"));
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("Nguyen Van A");
    expect(replies[0]).toContain("da dung 0/10");
    expect(employeeRepo.findByZaloId(NVKD_ID)).toBeDefined();
  });

  it("ignores self-sent messages", async () => {
    const msg = fakeTextMessage(ADMIN_ID, "Admin", "han muc");
    (msg as { isSelf: boolean }).isSelf = true;
    await router.handle(msg);
    expect(replies).toHaveLength(0);
  });

  it("does not let a non-admin run /quota all", async () => {
    employeeRepo.getOrCreate(NVKD_ID, "Nguyen Van A", 10);
    await router.handle(fakeTextMessage(NVKD_ID, "Nguyen Van A", "/quota all"));
    expect(replies[0]).toContain("Nguyen Van A");
    expect(replies[0]).not.toContain("Han muc tat ca NVKD");
  });

  it("lets an admin list all employee quotas", async () => {
    employeeRepo.getOrCreate(NVKD_ID, "Nguyen Van A", 10);
    await router.handle(fakeTextMessage(ADMIN_ID, "Admin", "/quota all"));
    expect(replies[0]).toContain("Han muc tat ca NVKD");
    expect(replies[0]).toContain("Nguyen Van A");
  });

  it("lets an admin set an employee's quota via /setquota", async () => {
    employeeRepo.getOrCreate(NVKD_ID, "Nguyen Van A", 10);
    await router.handle(fakeTextMessage(ADMIN_ID, "Admin", "/setquota Nguyen Van A 999"));
    expect(replies[0]).toContain("999");
    expect(employeeRepo.findByZaloId(NVKD_ID)?.monthlyQuota).toBe(999);
  });

  it("lets an admin set the company quota via /setcompanyquota", async () => {
    await router.handle(fakeTextMessage(ADMIN_ID, "Admin", "/setcompanyquota 5000"));
    expect(replies[0]).toContain("5000");
    expect(companyRepo.getMonthlyQuota()).toBe(5000);
  });

  it("lets an admin deactivate an employee via /active", async () => {
    employeeRepo.getOrCreate(NVKD_ID, "Nguyen Van A", 10);
    await router.handle(fakeTextMessage(ADMIN_ID, "Admin", "/active Nguyen Van A off"));
    expect(employeeRepo.findByZaloId(NVKD_ID)?.active).toBe(false);
  });

  it("sends no reply for unrecognized text from a non-admin", async () => {
    await router.handle(fakeTextMessage(NVKD_ID, "Nguyen Van A", "xin chao"));
    expect(replies).toHaveLength(0);
  });

  it("replies to /help with admin commands only for admins", async () => {
    await router.handle(fakeTextMessage(NVKD_ID, "Nguyen Van A", "/help"));
    expect(replies[0]).not.toContain("Lenh danh cho Admin");

    await router.handle(fakeTextMessage(ADMIN_ID, "Admin", "/help"));
    expect(replies[1]).toContain("Lenh danh cho Admin");
  });
});

describe("MessageRouter (group images)", () => {
  const GROUP_ID = "group-1";

  let db: DB;
  let router: MessageRouter;
  let employeeRepo: EmployeeRepo;
  let groupCandidateRepo: GroupCandidateRepo;
  let replies: string[];
  let processImageCalls: Array<{ zaloId: string }>;
  let getGroupInfoCalls: string[];

  function fakeGroupImageMessage(uidFrom: string, dName: string): Message {
    return {
      type: ThreadType.Group,
      threadId: GROUP_ID,
      isSelf: false,
      data: { uidFrom, dName, content: { href: "http://example.com/a.jpg" } } as Message["data"],
    } as Message;
  }

  function fakeGroupTextMessage(uidFrom: string, dName: string, content: string): Message {
    return {
      type: ThreadType.Group,
      threadId: GROUP_ID,
      isSelf: false,
      data: { uidFrom, dName, content } as Message["data"],
    } as Message;
  }

  beforeEach(() => {
    db = openDatabase(":memory:");
    ensureCompanyConfig(db, 100);
    employeeRepo = new EmployeeRepo(db);
    groupCandidateRepo = new GroupCandidateRepo(db);
    const companyRepo = new CompanyRepo(db);
    const quotaService = new QuotaService(employeeRepo, new UsageRepo(db), companyRepo, () => 10);

    replies = [];
    processImageCalls = [];
    getGroupInfoCalls = [];
    const fakeZaloSession = {
      reply: async (_threadId: string, _type: ThreadType, text: string) => {
        replies.push(text);
      },
      downloadImage: async () => ({ buffer: Buffer.from("fake"), mimeType: "image/jpeg" }),
      getGroupInfo: async (groupId: string) => {
        getGroupInfoCalls.push(groupId);
        return { name: "Nhom Kinh Doanh", totalMember: 12 };
      },
    } as unknown as ZaloSessionManager;

    const fakePipeline = {
      processImage: async (employee: { zaloId: string }) => {
        processImageCalls.push({ zaloId: employee.zaloId });
        return { ok: true, message: "da xong" };
      },
    };
    const fakeServiceRegistry = {
      getPipeline: () => fakePipeline,
    } as unknown as ServiceRegistry;

    router = new MessageRouter(
      fakeZaloSession,
      quotaService,
      employeeRepo,
      companyRepo,
      fakeServiceRegistry,
      groupCandidateRepo,
    );
  });

  it("ignores images from a group the admin hasn't registered", async () => {
    await router.handle(fakeGroupImageMessage("member-1", "A"));
    expect(replies).toHaveLength(0);
    expect(processImageCalls).toHaveLength(0);
  });

  it("processes images from a registered group, using the group's quota rather than the sender's", async () => {
    employeeRepo.upsertManual({
      zaloId: GROUP_ID,
      name: "Nhom Kinh Doanh",
      monthlyQuota: 50,
      isGroup: true,
    });

    await router.handle(fakeGroupImageMessage("member-1", "A"));

    expect(replies).toEqual(["da xong"]);
    expect(processImageCalls).toEqual([{ zaloId: GROUP_ID }]);
    expect(employeeRepo.findByZaloId("member-1")).toBeUndefined();
  });

  it("records an unregistered group as a candidate on any message, including plain text", async () => {
    await router.handle(fakeGroupTextMessage("member-1", "A", "xin chao"));

    expect(replies).toHaveLength(0); // van khong tra loi lenh van ban trong nhom
    const candidates = groupCandidateRepo.listAll();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ groupId: GROUP_ID, name: "Nhom Kinh Doanh", totalMember: 12 });
  });

  it("does not re-fetch group info from Zalo once a group is already a known candidate", async () => {
    await router.handle(fakeGroupImageMessage("member-1", "A"));
    await router.handle(fakeGroupImageMessage("member-2", "B"));

    expect(getGroupInfoCalls).toEqual([GROUP_ID]); // chi goi Zalo 1 lan, lan dau phat hien
    expect(groupCandidateRepo.listAll()).toHaveLength(1);
  });
});
