import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthRole } from "../../../security/auth/auth.types.js";
import { sendSuccess } from "../../../../../shared/utils/response.js";

import * as service from "../rotation.service.js";

import {
  addMember,
  getConfig,
  getMembers,
  removeMember,
  updateConfig,
  updateMember
} from "../rotation.controller.js";

vi.mock("../rotation.service.js", () => ({
  getRotationConfig: vi.fn(),
  updateRotationConfig: vi.fn(),
  getMembers: vi.fn(),
  addMember: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

const adminRole: AuthRole = {
  id: 1,
  code: "ADMIN",
  displayName: "ADMIN"
};

const mockedService = vi.mocked(service);
const mockedSendSuccess = vi.mocked(sendSuccess);

function createResponse(): Response {
  return {} as Response;
}

function createNext(): NextFunction {
  return vi.fn() as NextFunction;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: {
      id: 101,
      username: "testuser",
      roles: [adminRole]
    },
    ...overrides
  } as Request;
}

function createConfig() {
  return {
    placementId: 12,
    rotationEnabled: true,
    rotationMode: "TIME_BASED" as const,
    rotationIntervalSeconds: 10,
    rotationStrategy: "ROUND_ROBIN" as const
  };
}

function createMember() {
  return {
    id: 21,
    placementId: 12,
    advertisementId: 45,
    advertisementName: "Test Advertisement",
    advertisementStatus: "ACTIVE",
    advertisementWorkflowStatus: "APPROVED",
    priority: 100,
    status: "ACTIVE" as const,
    createdAt: new Date("2026-09-28T10:00:00.000Z"),
    updatedAt: new Date("2026-09-28T10:00:00.000Z")
  };
}

describe("Advertisement Rotation Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConfig()", () => {
    it("should retrieve the rotation configuration successfully", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        }
      });

      const res = createResponse();
      const next = createNext();
      const config = createConfig();

      mockedService.getRotationConfig.mockResolvedValue(config);

      await getConfig(req, res, next);

      expect(mockedService.getRotationConfig).toHaveBeenCalledTimes(1);
      expect(mockedService.getRotationConfig).toHaveBeenCalledWith(12);

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation configuration retrieved successfully.",
        config
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation configuration lookup failed.");

      mockedService.getRotationConfig.mockRejectedValue(error);

      await getConfig(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("updateConfig()", () => {
    it("should update the rotation configuration successfully", async () => {
      const input = {
        rotationEnabled: true,
        rotationMode: "TIME_BASED" as const,
        rotationIntervalSeconds: 15,
        rotationStrategy: "ROUND_ROBIN" as const
      };

      const req = createRequest({
        params: {
          placementId: "12"
        },
        body: input,
        user: {
          id: 205,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const updatedConfig = {
        ...createConfig(),
        rotationIntervalSeconds: 15
      };

      mockedService.updateRotationConfig.mockResolvedValue(updatedConfig);

      await updateConfig(req, res, next);

      expect(mockedService.updateRotationConfig).toHaveBeenCalledTimes(1);

      expect(mockedService.updateRotationConfig).toHaveBeenCalledWith(
        12,
        input,
        205
      );

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation configuration updated successfully.",
        updatedConfig
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the authenticated user id to the service", async () => {
      const input = {
        rotationEnabled: false
      };

      const req = createRequest({
        params: {
          placementId: "15"
        },
        body: input,
        user: {
          id: 999,
          username: "manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const updatedConfig = {
        ...createConfig(),
        placementId: 15,
        rotationEnabled: false
      };

      mockedService.updateRotationConfig.mockResolvedValue(updatedConfig);

      await updateConfig(req, res, next);

      expect(mockedService.updateRotationConfig).toHaveBeenCalledWith(
        15,
        input,
        999
      );
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        },
        body: {
          rotationEnabled: true
        },
        user: {
          id: 205,
          username: "manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation configuration update failed.");

      mockedService.updateRotationConfig.mockRejectedValue(error);

      await updateConfig(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getMembers()", () => {
    it("should retrieve rotation members successfully", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        }
      });

      const res = createResponse();
      const next = createNext();

      const members = [createMember()];

      mockedService.getMembers.mockResolvedValue(members);

      await getMembers(req, res, next);

      expect(mockedService.getMembers).toHaveBeenCalledTimes(1);
      expect(mockedService.getMembers).toHaveBeenCalledWith(12);

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation members retrieved successfully.",
        members
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty member collection successfully", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.getMembers.mockResolvedValue([]);

      await getMembers(req, res, next);

      expect(mockedService.getMembers).toHaveBeenCalledWith(12);

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation members retrieved successfully.",
        []
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation members lookup failed.");

      mockedService.getMembers.mockRejectedValue(error);

      await getMembers(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("addMember()", () => {
    it("should add a rotation member successfully with HTTP 201", async () => {
      const input = {
        advertisementId: 45,
        priority: 100,
        status: "ACTIVE" as const
      };

      const req = createRequest({
        params: {
          placementId: "12"
        },
        body: input,
        user: {
          id: 205,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const member = createMember();

      mockedService.addMember.mockResolvedValue(member);

      await addMember(req, res, next);

      expect(mockedService.addMember).toHaveBeenCalledTimes(1);
      expect(mockedService.addMember).toHaveBeenCalledWith(12, input, 205);

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation member added successfully.",
        member,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the authenticated user id to the service", async () => {
      const input = {
        advertisementId: 45
      };

      const req = createRequest({
        params: {
          placementId: "12"
        },
        body: input,
        user: {
          id: 777,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.addMember.mockResolvedValue(createMember());

      await addMember(req, res, next);

      expect(mockedService.addMember).toHaveBeenCalledWith(12, input, 777);
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12"
        },
        body: {
          advertisementId: 45
        },
        user: {
          id: 205,
          username: "manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation member creation failed.");

      mockedService.addMember.mockRejectedValue(error);

      await addMember(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("updateMember()", () => {
    it("should update a rotation member successfully", async () => {
      const input = {
        priority: 250,
        status: "ACTIVE" as const
      };

      const updatedMember = {
        ...createMember(),
        priority: 250
      };

      const req = createRequest({
        params: {
          placementId: "12",
          memberId: "21"
        },
        body: input,
        user: {
          id: 205,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.updateMember.mockResolvedValue(updatedMember);

      await updateMember(req, res, next);

      expect(mockedService.updateMember).toHaveBeenCalledTimes(1);

      expect(mockedService.updateMember).toHaveBeenCalledWith(
        12,
        21,
        input,
        205
      );

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation member updated successfully.",
        updatedMember
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the authenticated user id to the service", async () => {
      const input = {
        priority: 500
      };

      const req = createRequest({
        params: {
          placementId: "18",
          memberId: "42"
        },
        body: input,
        user: {
          id: 888,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.updateMember.mockResolvedValue({
        ...createMember(),
        id: 42,
        placementId: 18,
        priority: 500
      });

      await updateMember(req, res, next);

      expect(mockedService.updateMember).toHaveBeenCalledWith(
        18,
        42,
        input,
        888
      );
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12",
          memberId: "21"
        },
        body: {
          priority: 200
        },
        user: {
          id: 205,
          username: "manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation member update failed.");

      mockedService.updateMember.mockRejectedValue(error);

      await updateMember(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("removeMember()", () => {
    it("should deactivate a rotation member successfully", async () => {
      const deactivatedMember = {
        ...createMember(),
        status: "INACTIVE" as const
      };

      const req = createRequest({
        params: {
          placementId: "12",
          memberId: "21"
        },
        user: {
          id: 205,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.removeMember.mockResolvedValue(deactivatedMember);

      await removeMember(req, res, next);

      expect(mockedService.removeMember).toHaveBeenCalledTimes(1);

      expect(mockedService.removeMember).toHaveBeenCalledWith(12, 21, 205);

      expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement rotation member deactivated successfully.",
        deactivatedMember
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the authenticated user id to the service", async () => {
      const req = createRequest({
        params: {
          placementId: "12",
          memberId: "21"
        },
        user: {
          id: 1234,
          username: "rotation-manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.removeMember.mockResolvedValue({
        ...createMember(),
        status: "INACTIVE" as const
      });

      await removeMember(req, res, next);

      expect(mockedService.removeMember).toHaveBeenCalledWith(12, 21, 1234);
    });

    it("should forward service errors to next()", async () => {
      const req = createRequest({
        params: {
          placementId: "12",
          memberId: "21"
        },
        user: {
          id: 205,
          username: "manager",
          roles: [adminRole]
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rotation member deactivation failed.");

      mockedService.removeMember.mockRejectedValue(error);

      await removeMember(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });
});
