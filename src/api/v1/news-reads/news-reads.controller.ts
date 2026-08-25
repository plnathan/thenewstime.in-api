import type { Request, Response } from "express";

import * as newsReadsService from "./news-reads.service.js";

import {
  createNewsReadSchema,
  newsIdParamSchema,
  popularNewsQuerySchema
} from "./news-reads.validation.js";

export const create = async (req: Request, res: Response): Promise<void> => {
  const data = createNewsReadSchema.parse(req.body);

  const result = await newsReadsService.createNewsRead(data);

  if (!result.created) {
    res.status(200).json({
      message: "News read already recorded recently.",
      data: null
    });

    return;
  }

  res.status(201).json({
    data: result.data
  });
};

export const count = async (req: Request, res: Response): Promise<void> => {
  const { id } = newsIdParamSchema.parse(req.params);

  const readCount = await newsReadsService.countNewsReads(id);

  res.status(200).json({
    data: {
      newsId: id,
      readCount
    }
  });
};

export const popular = async (req: Request, res: Response): Promise<void> => {
  const filter = popularNewsQuerySchema.parse(req.query);

  const items = await newsReadsService.findPopularNews(filter);

  res.status(200).json({
    data: items
  });
};
