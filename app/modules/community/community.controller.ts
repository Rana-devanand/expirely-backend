import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { createResponse } from "../../common/helper/response.helper";
import { groqService } from "../../common/service/groq.service";
import * as service from "./community.service";

const userId = (req: Request) => req.user!.id;

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getListings(userId(req), req.query.search as string, req.query.category as string, req.query.sellerId as string)));
});
export const one = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getListing(String(req.params.id), userId(req))));
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).send(createResponse(await service.createListing(userId(req), req.body), "Listing published"));
});
export const mine = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getMyListings(userId(req))));
});
export const update = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(
    await service.updateListing(userId(req), String(req.params.id), req.body),
    "Listing updated",
  ));
});
export const remove = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(
    await service.deleteListing(userId(req), String(req.params.id)),
    "Listing deleted",
  ));
});
export const status = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.updateListingStatus(userId(req), String(req.params.id), req.body.status)));
});
export const startChat = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).send(createResponse(await service.startConversation(userId(req), req.body.listingId)));
});
export const conversations = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getConversations(userId(req))));
});
export const messages = asyncHandler(async (req: Request, res: Response) => {
  const before = req.query.before ? String(req.query.before) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.send(createResponse(await service.getMessages(userId(req), String(req.params.id), before, limit)));
});
export const searchMessages = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.searchMessages(userId(req), String(req.params.id), String(req.query.q || ""), Number(req.query.limit || 50))));
});
export const sharedContent = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getSharedContent(userId(req), String(req.params.id))));
});
export const chatSettings = asyncHandler(async (req: Request, res: Response) => {
  res.send(
    createResponse(
      await service.getConversationSettings(
        userId(req),
        String(req.params.id),
      ),
    ),
  );
});
export const updateChatSettings = asyncHandler(
  async (req: Request, res: Response) => {
    res.send(
      createResponse(
        await service.updateConversationSettings(
          userId(req),
          String(req.params.id),
          req.body,
        ),
        "Chat settings updated",
      ),
    );
  },
);
export const send = asyncHandler(async (req: Request, res: Response) => {
  const senderId = userId(req);
  const conversationId = String(req.params.id);
  const idempotencyKey = String(
    req.headers["idempotency-key"] || req.body.clientMessageId || "",
  );
  const job = await service.enqueueMessage(
    senderId,
    conversationId,
    req.body,
    idempotencyKey,
  );
  res.status(202).send(createResponse(job, "Message queued"));
});
export const retryMessage = asyncHandler(async (req: Request, res: Response) => {
  res.send(
    createResponse(
      await service.retryQueuedMessage(userId(req), String(req.params.jobId)),
      "Message queued for retry",
    ),
  );
});
export const clearChat = asyncHandler(async (req: Request, res: Response) => {
  res.send(
    createResponse(
      await service.clearConversation(userId(req), String(req.params.id)),
      "Chat cleared",
    ),
  );
});
export const seen = asyncHandler(async (req: Request, res: Response) => {
  res.send(
    createResponse(
      await service.markConversationSeen(userId(req), String(req.params.id)),
    ),
  );
});
export const offer = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.respondToOffer(userId(req), String(req.params.messageId), req.body.status)));
});
export const aiAdvice = asyncHandler(async (req: Request, res: Response) => {
  const result = await groqService.generateMarketplaceAdvice(req.body);
  res.send(createResponse(result));
});
export const follow = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.followUser(userId(req), String(req.params.userId)), "User followed"));
});
export const unfollow = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.unfollowUser(userId(req), String(req.params.userId)), "User unfollowed"));
});
export const block = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.blockUser(userId(req), String(req.params.userId)), "User blocked"));
});
export const unblock = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.unblockUser(userId(req), String(req.params.userId)), "User unblocked"));
});
export const report = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).send(createResponse(
    await service.reportListing(userId(req), String(req.params.id), req.body),
    "Report sent to the administrators",
  ));
});
export const like = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).send(createResponse(
    await service.likeListing(userId(req), String(req.params.id)),
    "Product liked",
  ));
});
export const unlike = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(
    await service.unlikeListing(userId(req), String(req.params.id)),
    "Product unliked",
  ));
});
export const adminReports = asyncHandler(async (_req: Request, res: Response) => {
  res.send(createResponse(await service.getReports()));
});
export const reviewReport = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(
    await service.reviewReport(userId(req), String(req.params.id), req.body),
    "Report updated",
  ));
});
export const adminListings = asyncHandler(async (_req: Request, res: Response) => {
  res.send(createResponse(await service.getAdminListings()));
});
export const adminActivity = asyncHandler(async (_req: Request, res: Response) => {
  res.send(createResponse(await service.getAdminActivity()));
});
export const adminStats = asyncHandler(async (_req: Request, res: Response) => {
  res.send(createResponse(await service.getAdminCommunityStats()));
});
export const blockedUsers = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getBlockedUsers(userId(req))));
});

export const userProfile = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(await service.getUserProfile(userId(req), String(req.params.userId))));
});
