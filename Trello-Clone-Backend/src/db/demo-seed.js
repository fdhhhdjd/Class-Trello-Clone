// Demo seed (Vietnamese) — 3 companies, 10 users, realistic boards/cards.
// Idempotent: exits if the marker user already exists.
// Run: docker compose exec api node src/db/demo-seed.js
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";

const PASSWORD = "Demo@12345";
const STEP = 1024;
const day = (n) => new Date(Date.now() + n * 86400 * 1000);

const USERS = [
  { email: "an.nguyen@demo.vn", name: "An Nguyễn" },
  { email: "binh.tran@demo.vn", name: "Bình Trần" },
  { email: "chi.le@demo.vn", name: "Chi Lê" },
  { email: "dung.pham@demo.vn", name: "Dũng Phạm" },
  { email: "ha.vu@demo.vn", name: "Hà Vũ" },
  { email: "khanh.do@demo.vn", name: "Khánh Đỗ" },
  { email: "linh.hoang@demo.vn", name: "Linh Hoàng" },
  { email: "minh.bui@demo.vn", name: "Minh Bùi" },
  { email: "ngoc.dang@demo.vn", name: "Ngọc Đặng" },
  { email: "phuc.ly@demo.vn", name: "Phúc Lý" },
];

const LABELS = [
  { name: "Gấp", color: "#F87168" },
  { name: "Quan trọng", color: "#F5CD47" },
  { name: "Tính năng", color: "#4BCE97" },
  { name: "Bug", color: "#FCA5A5" },
  { name: "Thiết kế", color: "#9F8FEF" },
];

const LISTS = ["Cần làm", "Đang làm", "Đang review", "Hoàn thành"];

// company -> boards -> per-list card titles
const COMPANIES = [
  {
    name: "Tích Xanh Software",
    ownerIdx: 0,
    memberIdx: [1, 2, 3, 4],
    boards: [
      {
        name: "Sprint Q3 - Sản phẩm",
        bg: "linear-gradient(135deg, #1868DB 0%, #0747A6 100%)",
        cards: {
          "Cần làm": ["Thiết kế màn hình đăng nhập mới", "API báo cáo doanh thu", "Tích hợp thanh toán VNPAY", "Viết tài liệu API"],
          "Đang làm": ["Trang dashboard khách hàng", "Tối ưu tốc độ tải trang"],
          "Đang review": ["Sửa lỗi đăng xuất bị treo"],
          "Hoàn thành": ["Cập nhật thư viện bảo mật", "Migrate database sang v2"],
        },
      },
      {
        name: "Tuyển dụng 2026",
        bg: "linear-gradient(135deg, #0EA47A 0%, #086650 100%)",
        cards: {
          "Cần làm": ["Đăng tin tuyển Fullstack", "Sàng lọc CV Backend", "Chuẩn bị đề phỏng vấn"],
          "Đang làm": ["Phỏng vấn vòng 1 - 3 ứng viên"],
          "Đang review": ["Offer cho ứng viên Designer"],
          "Hoàn thành": ["Onboarding nhân viên mới tháng 5"],
        },
      },
    ],
  },
  {
    name: "Cà Phê Khởi Nghiệp",
    ownerIdx: 1,
    memberIdx: [0, 5, 6, 7],
    boards: [
      {
        name: "Marketing Tết 2026",
        bg: "linear-gradient(135deg, #E8590C 0%, #BD3A00 100%)",
        cards: {
          "Cần làm": ["Lên ý tưởng video TikTok", "Thiết kế ly giấy bản Tết", "Chương trình mua 1 tặng 1"],
          "Đang làm": ["Chạy quảng cáo Facebook", "Hợp tác KOL ẩm thực"],
          "Đang review": ["Duyệt nội dung fanpage tuần này"],
          "Hoàn thành": ["Ra mắt menu mùa đông"],
        },
      },
      {
        name: "Vận hành cửa hàng",
        bg: "linear-gradient(135deg, #172B4D 0%, #091E42 100%)",
        cards: {
          "Cần làm": ["Đặt nguyên liệu tuần tới", "Lịch trực nhân viên", "Bảo trì máy pha cà phê"],
          "Đang làm": ["Đào tạo barista mới"],
          "Đang review": [],
          "Hoàn thành": ["Kiểm kê kho cuối tháng"],
        },
      },
    ],
  },
  {
    name: "Shop Thời Trang Hạ Long",
    ownerIdx: 2,
    memberIdx: [8, 9, 0],
    boards: [
      {
        name: "Bộ sưu tập Xuân Hè",
        bg: "linear-gradient(135deg, #A855F7 0%, #6D28D9 100%)",
        cards: {
          "Cần làm": ["Chụp ảnh sản phẩm mới", "Mô tả 20 sản phẩm áo", "Lên giá bộ sưu tập"],
          "Đang làm": ["Thiết kế banner website", "Quay clip thử đồ"],
          "Đang review": ["Duyệt mẫu váy maxi"],
          "Hoàn thành": ["Nhập hàng đợt 1"],
        },
      },
    ],
  },
];

const STATUS_BY_LIST = { "Cần làm": null, "Đang làm": "doing", "Đang review": "doing", "Hoàn thành": "done" };

async function main() {
  const marker = await prisma.user.findUnique({ where: { email: USERS[0].email }, select: { id: true } });
  if (marker) {
    console.log("Demo data already present (marker user exists). Skipping.");
    return;
  }

  const userRole = await prisma.role.findUnique({ where: { key: "user" }, select: { id: true } });
  const wsOwner = await prisma.role.findUnique({ where: { key: "ws_owner" }, select: { id: true } });
  const wsMember = await prisma.role.findUnique({ where: { key: "ws_member" }, select: { id: true } });
  if (!userRole || !wsOwner || !wsMember) throw new Error("Base roles missing — run the main seed first.");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Users
  const users = [];
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: { email: u.email, name: u.name, passwordHash, isActive: true },
      select: { id: true, name: true },
    });
    await prisma.userRole.create({ data: { userId: created.id, roleId: userRole.id, tenantId: null, grantedBy: created.id } });
    users.push(created);
  }
  console.log(`Created ${users.length} users.`);

  let boardCount = 0;
  let cardCount = 0;

  for (const co of COMPANIES) {
    const owner = users[co.ownerIdx];
    const ws = await prisma.workspace.create({
      data: { name: co.name, ownerId: owner.id, visibility: "workspace" },
      select: { id: true },
    });
    await prisma.userRole.create({ data: { userId: owner.id, roleId: wsOwner.id, tenantId: ws.id, grantedBy: owner.id } });
    const memberUsers = co.memberIdx.map((i) => users[i]);
    for (const m of memberUsers) {
      await prisma.userRole.create({ data: { userId: m.id, roleId: wsMember.id, tenantId: ws.id, grantedBy: owner.id } });
    }
    const wsMembers = [owner, ...memberUsers];

    for (const b of co.boards) {
      const board = await prisma.board.create({
        data: { workspaceId: ws.id, name: b.name, background: b.bg, visibility: "workspace" },
        select: { id: true },
      });
      boardCount += 1;

      // labels
      const labels = [];
      for (const l of LABELS) {
        labels.push(await prisma.label.create({ data: { boardId: board.id, name: l.name, color: l.color }, select: { id: true } }));
      }

      let listPos = STEP;
      let seq = 0;
      for (const listName of LISTS) {
        const list = await prisma.list.create({
          data: { boardId: board.id, name: listName, position: listPos },
          select: { id: true },
        });
        listPos += STEP;

        const titles = b.cards[listName] ?? [];
        let cardPos = STEP;
        for (let ci = 0; ci < titles.length; ci++) {
          seq += 1;
          const assignee = wsMembers[(ci + seq) % wsMembers.length];
          const withDue = ci % 2 === 0;
          const card = await prisma.card.create({
            data: {
              listId: list.id,
              number: seq,
              title: titles[ci],
              status: STATUS_BY_LIST[listName],
              position: cardPos,
              dueDate: withDue ? day((ci % 5) - 1) : null,
              members: { create: [{ userId: assignee.id }] },
              cardLabels: { create: [{ labelId: labels[ci % labels.length].id }] },
            },
            select: { id: true },
          });
          cardPos += STEP;
          cardCount += 1;

          // a checklist on some cards
          if (ci === 0) {
            await prisma.checklist.create({
              data: {
                cardId: card.id, title: "Các bước", position: STEP,
                items: { create: [
                  { text: "Phân tích yêu cầu", done: true, position: STEP },
                  { text: "Thực hiện", done: listName === "Hoàn thành", position: STEP * 2 },
                  { text: "Kiểm thử", done: listName === "Hoàn thành", position: STEP * 3 },
                ] },
              },
            });
          }
          // a comment on some cards
          if (withDue) {
            await prisma.comment.create({ data: { cardId: card.id, authorId: owner.id, body: "Ưu tiên xử lý trong tuần này nhé cả nhà." } });
          }
        }
        await prisma.board.update({ where: { id: board.id }, data: { cardSeq: seq } });
      }
    }
    console.log(`Workspace "${co.name}" ready.`);
  }

  console.log(`Demo seed done: ${users.length} users, ${COMPANIES.length} companies, ${boardCount} boards, ${cardCount} cards. Password: ${PASSWORD}`);
}

main()
  .catch((e) => { console.error("Demo seed failed:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
