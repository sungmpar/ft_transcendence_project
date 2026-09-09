export type PersistenceStatus =
  | "pending"
  | "saving"
  | "retrying"
  | "saved"
  | "failed"
  | "aborted";

/** Match outcome and durable persistence are separate server facts. */
export class OnlineResultNotice {
  private roomId = "";
  private current: PersistenceStatus = "pending";

  get status(): PersistenceStatus {
    return this.current;
  }

  reset(roomId = ""): void {
    this.roomId = roomId;
    this.current = "pending";
  }

  receive(value: unknown): boolean {
    if (!value || typeof value !== "object" || !this.roomId) return false;
    const message = value as { roomId?: unknown; status?: unknown };
    if (
      message.roomId !== this.roomId ||
      !["saving", "retrying", "saved", "failed"].includes(
        message.status as string
      )
    )
      return false;
    if (["saved", "failed", "aborted"].includes(this.current)) return false;
    this.current = message.status as PersistenceStatus;
    return true;
  }

  abort(value: unknown): boolean {
    if (!value || typeof value !== "object" || !this.roomId) return false;
    const message = value as { roomId?: unknown; status?: unknown };
    if (
      message.roomId !== this.roomId ||
      message.status !== "aborted" ||
      ["saved", "failed", "aborted"].includes(this.current)
    )
      return false;
    this.current = "aborted";
    return true;
  }

  get message(): string {
    switch (this.current) {
      case "saved":
        return "경기 결과가 저장되었습니다.";
      case "failed":
        return "경기는 종료됐지만 결과 저장에 실패했습니다. 승패 기록과 업적의 반영 여부를 확인할 수 없습니다.";
      case "aborted":
        return "서버 오류로 경기가 중단되었습니다. 승패 결과와 업적은 기록되지 않았습니다.";
      case "retrying":
        return "경기 종료 · 결과 저장을 재시도하고 있습니다.";
      case "saving":
        return "경기 종료 · 결과를 저장하고 있습니다.";
      default:
        return "경기는 끝났지만 전적 저장 여부를 확인하지 못했습니다.";
    }
  }
}
