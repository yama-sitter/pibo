import 'reflect-metadata'
import { Member, Members } from '../entities'
import {
  TargetMemberRepository,
  HistoryMemberRepository,
  ChattingMemberRepository,
} from '../repositories'
import { di } from '../utils'

export class DuplicatedMemberError extends Error {}
export class NotFoundMemberError extends Error {}

/**
 * 雑談のメンバーを管理する
 */
export class ChatMemberManager {
  private readonly targetMemberRepository: TargetMemberRepository
  private readonly historyMemberRepository: HistoryMemberRepository
  private readonly chattingMemberRepository: ChattingMemberRepository

  constructor() {
    this.targetMemberRepository = di.container.get<TargetMemberRepository>(
      di.TYPES.TargetMemberRepository
    )
    this.historyMemberRepository = di.container.get<HistoryMemberRepository>(
      di.TYPES.TargetMemberRepository
    )
    this.chattingMemberRepository = di.container.get<ChattingMemberRepository>(
      di.TYPES.TargetMemberRepository
    )
  }

  /**
   * メンバーを雑談開始時に招集する対象に追加する
   * @param {string} memberId メンバーID
   * @param {string} memberName メンバー名
   */
  async addTargetMember(memberId: string, memberName: string): Promise<void> {
    const member = new Member(memberId, memberName)

    const hasBeenAdded = await this.hasBeenAdded(member)
    if (hasBeenAdded) {
      throw new DuplicatedMemberError('Member have already joined.')
    }

    await this.targetMemberRepository.add(member)
  }

  /**
   * メンバーを雑談開始時に招集する対象から削除する
   * @param {string} memberId メンバーID
   * @param {string} memberName メンバー名
   */
  async removeTargetMember(memberId: string, memberName: string): Promise<void> {
    const member = new Member(memberId, memberName)

    const hasBeenAdded = await this.hasBeenAdded(member)
    if (!hasBeenAdded) {
      throw new NotFoundMemberError('Member have not joined')
    }

    await this.targetMemberRepository.remove(member)
  }

  /**
   * 雑談の招集対象となるメンバー一覧を取得する
   */
  async getTargetMembers(): Promise<Members> {
    return await this.targetMemberRepository.getAll()
  }

  /**
   * 雑談中のメンバー一覧を取得する
   */
  async getChattingMembers(): Promise<Members> {
    return await this.chattingMemberRepository.getAll()
  }

  /**
   * 雑談の招集対象のメンバーをランダムに取得する
   * 現在のメンバー一覧と招集履歴を突き合わせ、可能な限り履歴に存在しないメンバーを選ぶ
   * @param {number} numberOfTargetMember 取得人数
   */
  async pickMembers(numberOfTargetMember: number): Promise<Members> {
    const targetMembers = await this.targetMemberRepository.getAll()
    const gatheredMembers = await this.historyMemberRepository.getAll()

    // 現在のメンバー一覧から招集履歴に存在しないメンバーを抽出する
    const unGatheredMembers = targetMembers.remove(gatheredMembers)

    if (unGatheredMembers.count < numberOfTargetMember) {
      // 招集履歴に存在しないメンバーの数が取得人数を下回る場合、記録を全削除しリセットする
      // ※ 記録が埋まってしまうため
      await this.historyMemberRepository.remove(gatheredMembers)
    }

    // 取得人数を（可能な限り）満たすメンバー一覧をランダムに取得する
    const pickedMembers = unGatheredMembers.pickRandomlyToFill(numberOfTargetMember, targetMembers)

    // 取得されたメンバーを履歴に記録する
    await this.historyMemberRepository.add(pickedMembers)
    // 取得されたメンバーを雑談中のメンバーとして記録する
    await this.chattingMemberRepository.add(pickedMembers)

    return pickedMembers
  }

  private async hasBeenAdded(member: Member): Promise<boolean> {
    const _member = await this.targetMemberRepository.findById(member.id)
    return !!_member
  }
}
