import type { NextFunction, Request, Response } from "express";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as service from "../schedule.service.js";

import {
  activate,
  cancel,
  complete,
  create,
  getAll,
  getById,
  pause,
  resume,
  update
} from "../schedule.controller.js";

vi.mock("../schedule.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn()
}));

const mockResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  vi.mocked(response.status).mockReturnValue(response);

  return response;
};

const mockNext = vi.fn() as unknown as NextFunction;

describe("Advertisement Schedule Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get all schedules", async () => {
    const schedules = [
      {
        id: 1,
        advertisementId: 10,
        placementId: 20
      }
    ];

    vi.mocked(service.getAll).mockResolvedValue(schedules as any);

    const req = {
      query: {
        advertisementId: 10,
        placementId: 20,
        status: "ACTIVE"
      }
    } as unknown as Request;

    const res = mockResponse();

    await getAll(req, res, mockNext);

    expect(service.getAll).toHaveBeenCalledWith({
      advertisementId: 10,
      placementId: 20,
      status: "ACTIVE"
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should get a schedule by id", async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 1
    } as any);

    const req = {
      params: {
        id: "1"
      }
    } as unknown as Request;

    const res = mockResponse();

    await getById(req, res, mockNext);

    expect(service.getById).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("should create a schedule", async () => {
    vi.mocked(service.create).mockResolvedValue({
      id: 1
    } as any);

    const req = {
      body: {
        advertisementId: 10,
        placementId: 20
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await create(req, res, mockNext);

    expect(service.create).toHaveBeenCalledWith(req.body, 100);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should update a schedule", async () => {
    vi.mocked(service.update).mockResolvedValue({
      id: 1
    } as any);

    const req = {
      params: {
        id: "1"
      },
      body: {
        priority: 10
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await update(req, res, mockNext);

    expect(service.update).toHaveBeenCalledWith(1, req.body, 100);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("should activate a schedule", async () => {
    vi.mocked(service.activate).mockResolvedValue({
      id: 1,
      status: "ACTIVE"
    } as any);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await activate(req, res, mockNext);

    expect(service.activate).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should pause a schedule", async () => {
    vi.mocked(service.pause).mockResolvedValue({
      id: 1,
      status: "PAUSED"
    } as any);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await pause(req, res, mockNext);

    expect(service.pause).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should resume a schedule", async () => {
    vi.mocked(service.resume).mockResolvedValue({
      id: 1,
      status: "ACTIVE"
    } as any);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await resume(req, res, mockNext);

    expect(service.resume).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should complete a schedule", async () => {
    vi.mocked(service.complete).mockResolvedValue({
      id: 1,
      status: "COMPLETED"
    } as any);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await complete(req, res, mockNext);

    expect(service.complete).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should cancel a schedule", async () => {
    vi.mocked(service.cancel).mockResolvedValue({
      id: 1,
      status: "CANCELLED"
    } as any);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 100
      }
    } as unknown as Request;

    const res = mockResponse();

    await cancel(req, res, mockNext);

    expect(service.cancel).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it("should pass service errors to next", async () => {
    const error = new Error("Service failure");

    vi.mocked(service.getById).mockRejectedValue(error);

    const req = {
      params: {
        id: "1"
      }
    } as unknown as Request;

    const res = mockResponse();

    await getById(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
