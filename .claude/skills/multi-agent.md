# Multi-Agent Orchestration — Parallel Fan-Out

> "Task nhỏ: 1 agent. Task lớn: chia nhỏ, fan-out, cap <= 5 song song."

Activate: khi tác vụ cần xử lý nhiều việc độc lập (sweep nhiều file, nhiều module, nhiều câu hỏi search) → dùng nhiều agent. Tác vụ đơn lẻ → 1 agent là đủ.

---

## Decision Rule (Claude tự tính)

Trước khi spawn, ước lượng số "đơn vị việc độc lập" (file/module/query/check):

| Đơn vị việc | Cách làm | Số agent |
|-------------|----------|----------|
| 1 việc, hoặc đọc 1 vùng code đã biết | Làm trực tiếp, không spawn | 0 |
| 2-3 việc nhỏ liên quan | 1 agent gom lại | 1 |
| 4+ việc độc lập, không phụ thuộc nhau | Fan-out song song | **cap 5** |
| > 5 việc | Chia batch, mỗi batch <= 5, chạy tuần tự | 5/batch |

**Hard cap: tối đa 5 agent song song.** Vượt 5 → xếp hàng theo batch.

---

## Khi nào dùng nhiều agent

- Sweep/search rộng > 3 query khác nhau → mỗi nhánh 1 agent (Explore).
- Review/audit nhiều dimension (bug, perf, security) → mỗi dimension 1 agent.
- Sửa/migrate nhiều file độc lập cùng lúc → mỗi file 1 agent (worktree nếu ghi song song).
- Nghiên cứu nhiều nguồn → mỗi nguồn 1 agent rồi tổng hợp.

## Khi nào KHÔNG dùng

- Việc tuần tự, bước sau cần kết quả bước trước → 1 agent.
- Đọc 1 file/1 hàm đã biết vị trí → làm trực tiếp, không spawn.
- Sửa 1 chỗ nhỏ → tự làm.

---

## Cách spawn

1. **Độc lập → 1 message, nhiều Agent call** để chạy song song (không gọi tuần tự).
2. **Mỗi agent 1 scope rõ ràng**, prompt nói rõ "trả về kết luận, không dump file".
3. **Explore** cho search read-only; **general-purpose** cho việc multi-step có ghi.
4. **Tổng hợp**: sau khi các agent xong, gom kết quả, dedup, kết luận 1 lần.
5. Việc lớn (migrate/audit toàn repo, nhiều phase) → cân nhắc Workflow nếu user opt-in.

---

## Pre-spawn Checklist

- [ ] Đếm đơn vị việc độc lập → quyết định 0/1/<=5 agent.
- [ ] > 5 việc? → chia batch <= 5.
- [ ] Các nhánh có thật sự độc lập không? → nếu phụ thuộc, dùng 1 agent.
- [ ] Đã gộp các Agent call độc lập vào 1 message chưa?
- [ ] Mỗi agent có scope + schema/output rõ ràng chưa?
