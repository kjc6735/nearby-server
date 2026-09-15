import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  ParticipationWhereUniqueInput,
  TripPostInclude,
} from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { TripPostService } from '../trip-post/trip-post.service';
import {
  ParticipationStatus,
  TripPostStatus,
} from './../generated/prisma/enums';
import { UsersService } from './../users/users.service';
import { ParticipationDto } from './dto/participation.dto';

@Injectable()
export class ParticipationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UsersService,
    private readonly tripPostService: TripPostService,
  ) {}

  async getParticipationsByAuthor({
    tripPostId,
    requestUserId,
  }: {
    tripPostId: number;
    requestUserId: number;
  }) {
    const tripPostWithParticipations = await this.tripPostService.findOne({
      where: {
        id: tripPostId,
      },
      include: {
        author: true,
        participations: {
          include: { user: true },
        },
      } satisfies TripPostInclude,
    });

    if (!tripPostWithParticipations)
      throw new NotFoundException('존재하지 않는 게시물입니다.');
    if (tripPostWithParticipations.author.id !== requestUserId)
      throw new ForbiddenException('해당 게시물 조회 권한이 없습니다.');

    const { participations } = tripPostWithParticipations;
    return ParticipationDto.fromMany(participations);
  }

  async applyForTripPost({
    userId,
    tripPostId,
  }: {
    userId: number;
    tripPostId: number;
  }) {
    const user = await this.userService.findOne({ id: userId });
    const post = await this.tripPostService.findOne({
      where: { id: tripPostId },
    });

    // 존재여부 체크
    if (!user) throw new NotFoundException('존재하지 않는 사용자입니다.');
    if (!post) throw new NotFoundException('존재하지 않는 게시물입니다.');
    if (post.authorId === user.id)
      throw new BadRequestException('본인 게시물에는 지원할 수 없습니다.');
    //게시물 상태 체크
    if (post.status !== TripPostStatus.OPEN) {
      throw new BadRequestException('현재 지원할 수 없습니다.');
    }

    const existing = await this.getParticipation({
      where: { tripPostId_userId: { tripPostId, userId } },
    });
    if (existing?.status === ParticipationStatus.REJECTED) {
      throw new ForbiddenException(
        '거절된 게시물에는 다시 지원할 수 없습니다.',
      );
    }
    if (existing) {
      throw new ConflictException('이미 지원한 게시물입니다.');
    }

    try {
      return await this.create({
        userId,
        tripPostId,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('이미 지원한 게시물입니다.');
      throw e;
    }
  }

  // 내 지원 취소
  async cancelMyApplication({
    userId,
    participationId,
    tripPostId,
  }: {
    userId: number;
    participationId: number;
    tripPostId: number;
  }) {
    // 자신인지 확인
    const user = await this.userService.findOne({ id: userId });
    const myApplication = await this.getParticipation({
      where: {
        id: participationId,
        userId: userId,
        tripPostId: tripPostId,
      },
    });

    if (!user) throw new NotFoundException('존재하지 않는 사용자입니다.');

    if (!myApplication) {
      throw new NotFoundException('게시물 또는 지원 이력이 없습니다.');
    }

    // 재지원 막기
    if (myApplication.status === ParticipationStatus.REJECTED) {
      throw new BadRequestException('거절된 지원은 취소할 수 없습니다.');
    }

    try {
      await this.delete({
        where: {
          id: myApplication.id,
        },
      });

      // 인원 바뀌면 모집으로 수정
      if (myApplication.status === ParticipationStatus.APPROVED) {
        const post = await this.tripPostService.findOne({
          where: { id: tripPostId },
        });
        if (post?.status === TripPostStatus.CLOSED) {
          await this.tripPostService.update({
            where: { id: tripPostId },
            status: TripPostStatus.OPEN,
          });
        }
      }
    } catch (e) {
      throw new InternalServerErrorException(
        '게시물 가입 신청 삭제가 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
  }

  // author에 의한 가입승인
  async changeApplicationStatusByAuthor({
    authorId,
    participationId,
    tripPostId,
    status,
  }: {
    authorId: number;
    participationId: number;
    tripPostId: number;
    status:
      typeof ParticipationStatus.APPROVED | typeof ParticipationStatus.REJECTED;
  }) {
    if (
      status !== ParticipationStatus.APPROVED &&
      status !== ParticipationStatus.REJECTED
    )
      throw new BadRequestException('변경할 수 없는 상태입니다.');

    const author = await this.userService.findOne({ id: authorId });
    const post = await this.tripPostService.findOne({
      where: { id: tripPostId },
    });
    const participations = await this.getParticipations({
      tripPostId,
      status: ParticipationStatus.APPROVED,
    });

    const userApplication = await this.getParticipation({
      where: { id: participationId },
    });

    // 존재여부 체크
    if (!userApplication)
      throw new NotFoundException('존재하지 않는 지원요청입니다');
    if (!author) throw new NotFoundException('존재하지 않는 사용자입니다.');
    if (!post) throw new NotFoundException('존재하지 않는 게시물입니다.');

    if (userApplication.tripPostId !== tripPostId) {
      throw new NotFoundException('존재하지 않는 지원요청입니다.');
    }
    // 수정권한 체크
    if (post.authorId !== author.id)
      throw new ForbiddenException('게시물 작성자만 변경할 수 있습니다.');

    // 새로 승인되는 경우
    const isApproving =
      userApplication.status !== ParticipationStatus.APPROVED &&
      status === ParticipationStatus.APPROVED;
    // 승인 -> 다른 상태
    const isUnapproving =
      userApplication.status === ParticipationStatus.APPROVED &&
      status !== ParticipationStatus.APPROVED;

    // 취소된 게시물은 변경 불가
    if (post.status === TripPostStatus.CANCELLED)
      throw new BadRequestException('취소된 여행입니다.');

    // 승인은 대기 중인 지원만 가능
    if (
      status === ParticipationStatus.APPROVED &&
      userApplication.status !== ParticipationStatus.PENDING
    )
      throw new BadRequestException('대기 중인 지원만 승인할 수 있습니다.');

    // 정원은 작성자 포함
    const memberCount = participations.length + 1;

    // 승인할 때만 모집 상태와 인원수 체크
    if (isApproving) {
      if (post.status !== TripPostStatus.OPEN)
        throw new BadRequestException('모집이 마감된 여행입니다.');
      if (memberCount + 1 > post.capacity)
        throw new BadRequestException('정원이 초과되었습니다.');
    }

    try {
      await this.changeStatus({
        id: userApplication.id,
        status,
      });
      if (isApproving && memberCount + 1 === post.capacity) {
        await this.tripPostService.update({
          where: { id: tripPostId },
          status: TripPostStatus.CLOSED,
        });
      } else if (isUnapproving && post.status === TripPostStatus.CLOSED) {
        await this.tripPostService.update({
          where: { id: tripPostId },
          status: TripPostStatus.OPEN,
        });
      }
    } catch (e) {
      throw new InternalServerErrorException(
        '상태 업데이트를 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
  }

  // core
  async create({ userId, tripPostId }: { userId: number; tripPostId: number }) {
    return this.prismaService.participation.create({
      data: {
        userId,
        tripPostId,
      },
    });
  }

  async getParticipation({ where }: { where: ParticipationWhereUniqueInput }) {
    return this.prismaService.participation.findUnique({ where });
  }

  async changeStatus({
    id,
    status,
  }: {
    id: number;
    status: ParticipationStatus;
  }) {
    return this.prismaService.participation.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }

  async getParticipations({
    tripPostId,
    status = ParticipationStatus.APPROVED,
  }: {
    tripPostId: number;
    status?: ParticipationStatus;
  }) {
    return this.prismaService.participation.findMany({
      where: {
        tripPostId,
        status,
      },
    });
  }

  async delete({ where }: { where: ParticipationWhereUniqueInput }) {
    return this.prismaService.participation.delete({
      where,
    });
  }
}
