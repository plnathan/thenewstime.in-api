import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../rotation.repository.js";

import {
  addMember,
  getMembers,
  getRotationConfig,
  removeMember,
  updateMember,
  updateRotationConfig
} from "../rotation.service.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    connect: vi.fn()
  }
}));

vi.mock("../rotation.repository.js", () => ({
  findRotationConfig: vi.fn(),
  updateRotationConfig: vi.fn(),
  findPlacementForUpdate: vi.fn(),
  findPlacement: vi.fn(),
  findMembersByPlacement: vi.fn(),
  findAdvertisement: vi.fn(),
  hasActivePlacementRule: vi.fn(),
  findMemberByAdvertisement: vi.fn(),
  findMemberById: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  deactivateMember: vi.fn(),
  findRotationLimits: vi.fn(),
  countActiveMembersByPlacement: vi.fn()
}));

const mockedRepository = vi.mocked(repository);
const mockedPool = vi.mocked(pool);

const createMockClient = () => ({
  query: vi.fn(),
  release: vi.fn()
});

const createConfig = () => ({
  placementId: 10,
  rotationEnabled: true,
  rotationMode: "TIME_BASED" as const,
  rotationIntervalSeconds: 10,
  rotationStrategy: "ROUND_ROBIN" as const
});

const createMember = () => ({
  id: 20,
  placementId: 10,
  advertisementId: 30,
  advertisementName: "Advertisement 30",
  advertisementStatus: "ACTIVE",
  advertisementWorkflowStatus: "APPROVED",
  priority: 100,
  status: "ACTIVE" as const,
  createdAt: new Date(),
  updatedAt: new Date()
});

const expectTransactionClient = (client: ReturnType<typeof createMockClient>) =>
  expect.objectContaining({
    query: client.query,
    release: client.release
  });

describe("rotation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedRepository.findRotationLimits.mockResolvedValue({
      maxActiveRotationMembersPerPlacement: 10,
      maxActiveCreativesPerAdvertisement: 10
    });

    mockedRepository.countActiveMembersByPlacement.mockResolvedValue(0);
  });

  it("should retrieve rotation configuration", async () => {
    mockedRepository.findPlacement.mockResolvedValue(true);
    mockedRepository.findRotationConfig.mockResolvedValue(createConfig());

    const result = await getRotationConfig(10);

    expect(result).toEqual(createConfig());

    expect(mockedRepository.findPlacement).toHaveBeenCalledWith(10);
    expect(mockedRepository.findRotationConfig).toHaveBeenCalledWith(10);
  });

  it("should reject a missing placement", async () => {
    mockedRepository.findPlacement.mockResolvedValue(false);

    await expect(getRotationConfig(999)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(mockedRepository.findRotationConfig).not.toHaveBeenCalled();
  });

  it("should reject invalid placement id", async () => {
    await expect(getRotationConfig(0)).rejects.toMatchObject({
      statusCode: 400
    });

    expect(mockedRepository.findPlacement).not.toHaveBeenCalled();
    expect(mockedRepository.findRotationConfig).not.toHaveBeenCalled();
  });

  it("should update rotation configuration transactionally", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);

    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);
    mockedRepository.findRotationConfig.mockResolvedValue(createConfig());

    mockedRepository.updateRotationConfig.mockResolvedValue({
      ...createConfig(),
      rotationIntervalSeconds: 20
    });

    const result = await updateRotationConfig(
      10,
      {
        rotationIntervalSeconds: 20
      },
      100
    );

    expect(result.rotationIntervalSeconds).toBe(20);

    expect(mockedRepository.findPlacementForUpdate).toHaveBeenCalledWith(
      10,
      client
    );

    expect(mockedRepository.updateRotationConfig).toHaveBeenCalledWith(
      10,
      {
        rotationIntervalSeconds: 20
      },
      100,
      client
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("should return rotation members", async () => {
    mockedRepository.findPlacement.mockResolvedValue(true);

    mockedRepository.findMembersByPlacement.mockResolvedValue([createMember()]);

    const result = await getMembers(10);

    expect(result).toHaveLength(1);
    expect(result[0]?.advertisementId).toBe(30);

    expect(mockedRepository.findPlacement).toHaveBeenCalledWith(10);
    expect(mockedRepository.findMembersByPlacement).toHaveBeenCalledWith(10);
  });

  it("should reject members for a missing placement", async () => {
    mockedRepository.findPlacement.mockResolvedValue(false);

    await expect(getMembers(999)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(mockedRepository.findMembersByPlacement).not.toHaveBeenCalled();
  });

  it("should add an eligible advertisement to rotation", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);

    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);

    mockedRepository.findAdvertisement.mockResolvedValue({
      id: 30,
      name: "Advertisement 30",
      status: "ACTIVE",
      workflowStatus: "APPROVED"
    });

    mockedRepository.hasActivePlacementRule.mockResolvedValue(true);
    mockedRepository.findMemberByAdvertisement.mockResolvedValue(null);
    mockedRepository.countActiveMembersByPlacement.mockResolvedValue(2);
    mockedRepository.createMember.mockResolvedValue(createMember());

    const result = await addMember(
      10,
      {
        advertisementId: 30,
        priority: 100
      },
      100
    );

    expect(result.advertisementId).toBe(30);

    expect(mockedRepository.findRotationLimits).toHaveBeenCalledWith(client);

    expect(mockedRepository.countActiveMembersByPlacement).toHaveBeenCalledWith(
      10,
      client
    );

    expect(mockedRepository.hasActivePlacementRule).toHaveBeenCalledWith(
      30,
      10,
      client
    );

    expect(mockedRepository.createMember).toHaveBeenCalledWith(
      10,
      {
        advertisementId: 30,
        priority: 100,
        status: "ACTIVE"
      },
      client
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("should reject an advertisement without an active placement rule", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);

    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);

    mockedRepository.findAdvertisement.mockResolvedValue({
      id: 30,
      name: "Advertisement 30",
      status: "ACTIVE",
      workflowStatus: "APPROVED"
    });

    mockedRepository.hasActivePlacementRule.mockResolvedValue(false);

    await expect(
      addMember(
        10,
        {
          advertisementId: 30
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();

    expect(mockedRepository.createMember).not.toHaveBeenCalled();
  });

  it("should reject duplicate rotation membership", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);

    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);

    mockedRepository.findAdvertisement.mockResolvedValue({
      id: 30,
      name: "Advertisement 30",
      status: "ACTIVE",
      workflowStatus: "APPROVED"
    });

    mockedRepository.hasActivePlacementRule.mockResolvedValue(true);

    mockedRepository.findMemberByAdvertisement.mockResolvedValue(
      createMember()
    );

    await expect(
      addMember(
        10,
        {
          advertisementId: 30
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockedRepository.createMember).not.toHaveBeenCalled();
  });

  it("should reject archived advertisements", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);

    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);

    mockedRepository.findAdvertisement.mockResolvedValue({
      id: 30,
      name: "Archived Advertisement",
      status: "ARCHIVED",
      workflowStatus: "ARCHIVED"
    });

    await expect(
      addMember(
        10,
        {
          advertisementId: 30
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockedRepository.hasActivePlacementRule).not.toHaveBeenCalled();
    expect(mockedRepository.createMember).not.toHaveBeenCalled();
  });

  it("should update an existing rotation member", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);
    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);

    const existingMember = createMember();

    const updatedMember = {
      ...existingMember,
      priority: 200
    };

    mockedRepository.findMemberById.mockResolvedValue(existingMember);
    mockedRepository.updateMember.mockResolvedValue(updatedMember);

    const result = await updateMember(
      10,
      20,
      {
        priority: 200
      },
      100
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 20,
        placementId: 10,
        advertisementId: 30,
        priority: 200,
        status: "ACTIVE"
      })
    );

    expect(mockedRepository.findMemberById).toHaveBeenCalledWith(
      10,
      20,
      expectTransactionClient(client)
    );

    expect(mockedRepository.updateMember).toHaveBeenCalledWith(
      10,
      20,
      {
        priority: 200
      },
      client
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("should reject removing an unknown member", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);
    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);
    mockedRepository.findMemberById.mockResolvedValue(null);

    await expect(removeMember(10, 999, 100)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(mockedRepository.findMemberById).toHaveBeenCalledWith(
      10,
      999,
      expectTransactionClient(client)
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();

    expect(mockedRepository.deactivateMember).not.toHaveBeenCalled();
  });

  it("should deactivate an existing member", async () => {
    const client = createMockClient();

    mockedPool.connect.mockResolvedValue(client as never);
    mockedRepository.findPlacementForUpdate.mockResolvedValue(true);
    mockedRepository.findMemberById.mockResolvedValue(createMember());

    mockedRepository.deactivateMember.mockResolvedValue({
      ...createMember(),
      status: "INACTIVE"
    });

    const result = await removeMember(10, 20, 100);

    expect(result.status).toBe("INACTIVE");

    expect(mockedRepository.findMemberById).toHaveBeenCalledWith(
      10,
      20,
      expectTransactionClient(client)
    );

    expect(mockedRepository.deactivateMember).toHaveBeenCalledWith(
      10,
      20,
      client
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
