import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  const adminPassword = await bcrypt.hash("admin123", 10)
  const agentPassword = await bcrypt.hash("agent123", 10)
  const clientPassword = await bcrypt.hash("client123", 10)

  const admin = await prisma.user.upsert({
    where: { email: "admin@helpdesk.local" },
    update: {},
    create: {
      email: "admin@helpdesk.local",
      name: "Admin Helpdesk",
      password: adminPassword,
      role: "ADMIN",
    },
  })

  const agent = await prisma.user.upsert({
    where: { email: "soporte@helpdesk.local" },
    update: {},
    create: {
      email: "soporte@helpdesk.local",
      name: "María Soporte",
      password: agentPassword,
      role: "AGENT",
    },
  })

  // Productos
  const erp = await prisma.product.upsert({
    where: { slug: "erp-core" },
    update: {},
    create: {
      slug: "erp-core",
      name: "ERP Core",
      description: "Sistema ERP modular para PyMEs",
      version: "3.2.0",
    },
  })

  const pos = await prisma.product.upsert({
    where: { slug: "pos-cloud" },
    update: {},
    create: {
      slug: "pos-cloud",
      name: "POS Cloud",
      description: "Punto de venta multi-sucursal",
      version: "1.8.4",
    },
  })

  // Clientes
  const acme = await prisma.customer.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      slug: "acme",
      name: "Acme Industrial",
      email: "contacto@acme.com",
      phone: "+54 11 5555-1234",
      website: "https://acme.example.com",
      status: "ACTIVE",
      notes: "Cliente estratégico desde 2023",
    },
  })

  const norte = await prisma.customer.upsert({
    where: { slug: "distribuidora-norte" },
    update: {},
    create: {
      slug: "distribuidora-norte",
      name: "Distribuidora Norte",
      email: "it@disnorte.com",
      phone: "+54 11 4444-9876",
      status: "ACTIVE",
    },
  })

  // Usuario cliente
  await prisma.user.upsert({
    where: { email: "juan@acme.com" },
    update: {},
    create: {
      email: "juan@acme.com",
      name: "Juan Cliente (Acme)",
      password: clientPassword,
      role: "CLIENT",
      customerId: acme.id,
    },
  })

  // Contactos
  await prisma.contact.createMany({
    skipDuplicates: true,
    data: [
      {
        customerId: acme.id,
        name: "Juan Pérez",
        email: "juan@acme.com",
        phone: "+54 11 5555-1100",
        role: "Gerente IT",
        isPrimary: true,
      },
      {
        customerId: norte.id,
        name: "Laura Méndez",
        email: "laura@disnorte.com",
        role: "Operaciones",
        isPrimary: true,
      },
    ],
  })

  // Sistemas
  const erpAcme = await prisma.system.create({
    data: {
      customerId: acme.id,
      productId: erp.id,
      name: "ERP Producción Acme",
      environment: "PRODUCTION",
      status: "ACTIVE",
      url: "https://erp.acme.example.com",
      installedAt: new Date("2023-08-15"),
    },
  })

  const posNorte = await prisma.system.create({
    data: {
      customerId: norte.id,
      productId: pos.id,
      name: "POS Sucursales Norte",
      environment: "PRODUCTION",
      status: "ACTIVE",
      installedAt: new Date("2024-02-10"),
    },
  })

  // Servidores
  const serverAcme = await prisma.server.create({
    data: {
      customerId: acme.id,
      name: "acme-prod-01",
      hostname: "acme-prod-01.internal",
      ipAddress: "10.10.0.5",
      location: "AWS us-east-1",
      provider: "AWS",
      os: "Ubuntu 22.04",
      cpuCores: 8,
      memoryGb: 32,
      diskGb: 500,
      status: "ONLINE",
      lastSeenAt: new Date(),
    },
  })

  const serverNorte = await prisma.server.create({
    data: {
      customerId: norte.id,
      name: "norte-prod-db",
      ipAddress: "192.168.50.10",
      location: "OnPrem Buenos Aires",
      provider: "OnPrem",
      os: "Debian 12",
      cpuCores: 4,
      memoryGb: 16,
      status: "DEGRADED",
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 15),
    },
  })

  // Server <-> System
  await prisma.serverSystem.createMany({
    skipDuplicates: true,
    data: [
      { serverId: serverAcme.id, systemId: erpAcme.id, role: "web+db" },
      { serverId: serverNorte.id, systemId: posNorte.id, role: "db" },
    ],
  })

  // Contenedores
  await prisma.container.createMany({
    skipDuplicates: true,
    data: [
      {
        serverId: serverAcme.id,
        systemId: erpAcme.id,
        name: "erp-app",
        image: "acme/erp",
        imageTag: "3.2.0",
        status: "RUNNING",
        cpuPercent: 12.5,
        memoryMb: 1240,
        lastSeenAt: new Date(),
      },
      {
        serverId: serverAcme.id,
        systemId: erpAcme.id,
        name: "erp-postgres",
        image: "postgres",
        imageTag: "16",
        status: "RUNNING",
        cpuPercent: 4.2,
        memoryMb: 820,
        lastSeenAt: new Date(),
      },
      {
        serverId: serverNorte.id,
        systemId: posNorte.id,
        name: "pos-db",
        image: "postgres",
        imageTag: "15",
        status: "RESTARTING",
        cpuPercent: 0,
        memoryMb: 0,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 5),
      },
    ],
  })

  // Tickets
  const ticket1 = await prisma.ticket.create({
    data: {
      code: "TKT-0001",
      type: "SUPPORT",
      title: "Error 500 al generar reportes mensuales",
      description:
        "Cuando intentamos generar el reporte mensual de ventas en el ERP, sale error 500 en los últimos 2 días.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      customerId: acme.id,
      systemId: erpAcme.id,
      serverId: serverAcme.id,
      createdById: admin.id,
      assignedToId: agent.id,
      tags: ["reporting", "erp"],
    },
  })

  await prisma.ticketComment.create({
    data: {
      ticketId: ticket1.id,
      authorId: agent.id,
      body: "Estoy revisando los logs del servidor. Parece relacionado con un timeout en la consulta de agregados.",
      source: "USER",
    },
  })

  await prisma.ticket.create({
    data: {
      code: "TKT-0002",
      type: "SUPPORT",
      title: "Caja registradora desconectada en sucursal 3",
      description: "La caja de la sucursal 3 muestra 'sin conexión' desde esta mañana.",
      status: "OPEN",
      priority: "URGENT",
      customerId: norte.id,
      systemId: posNorte.id,
      tags: ["conectividad"],
    },
  })

  await prisma.ticket.create({
    data: {
      code: "TKT-0003",
      type: "SUPPORT",
      title: "Solicitud de capacitación módulo de inventario",
      description: "El cliente solicita una sesión de capacitación para el módulo de inventario.",
      status: "WAITING_CLIENT",
      priority: "LOW",
      customerId: acme.id,
      systemId: erpAcme.id,
      tags: ["capacitacion"],
    },
  })

  // Implementación
  const impl = await prisma.ticket.create({
    data: {
      code: "IMP-0001",
      type: "IMPLEMENTATION",
      title: "Integración POS con e-commerce",
      description:
        "Integrar el POS Cloud con la tienda online del cliente para sincronizar inventario en tiempo real.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      customerId: norte.id,
      systemId: posNorte.id,
      assignedToId: agent.id,
      budgetAmount: 12500,
      budgetCurrency: "USD",
      estimatedHours: 120,
      actualHours: 32,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-07-15"),
      tags: ["integracion", "ecommerce"],
    },
  })

  await prisma.implementationPhase.createMany({
    data: [
      {
        ticketId: impl.id,
        name: "Análisis y diseño",
        order: 1,
        status: "COMPLETED",
        estimatedHours: 20,
        actualHours: 22,
      },
      {
        ticketId: impl.id,
        name: "Desarrollo de API de sincronización",
        order: 2,
        status: "IN_PROGRESS",
        estimatedHours: 60,
        actualHours: 10,
      },
      {
        ticketId: impl.id,
        name: "Pruebas e integración",
        order: 3,
        status: "PENDING",
        estimatedHours: 30,
      },
      {
        ticketId: impl.id,
        name: "Go-live y soporte post-deploy",
        order: 4,
        status: "PENDING",
        estimatedHours: 10,
      },
    ],
  })

  // KB
  await prisma.kbArticle.create({
    data: {
      slug: "erp-reportes-timeout",
      title: "Cómo resolver timeouts en reportes del ERP",
      body: "Los timeouts al generar reportes suelen estar relacionados con índices faltantes en la tabla de ventas. Verificar que existan los índices idx_ventas_fecha y idx_ventas_cliente.",
      tags: ["erp", "reporting", "performance"],
      published: true,
      productId: erp.id,
      createdById: admin.id,
    },
  })

  // Agente de IA por defecto
  await prisma.aiAgent.upsert({
    where: { slug: "asistente-general" },
    update: {},
    create: {
      name: "Asistente general",
      slug: "asistente-general",
      description: "Agente de soporte con acceso a KB, tickets e infraestructura.",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      systemPrompt:
        "Sos el asistente IA del helpdesk. Ayudás a resolver problemas, buscar en la base de conocimiento y gestionar tickets. Sé breve, claro y respondé en español. Antes de proponer soluciones, buscá en la KB. Pedí confirmación antes de crear o modificar tickets.",
      tools: [
        "search_knowledge_base",
        "get_ticket_by_code",
        "list_recent_tickets",
        "get_customer_overview",
        "get_server_status",
        "create_ticket",
        "update_ticket_status",
        "add_ticket_comment",
      ],
      temperature: 0.7,
      maxTokens: 2048,
      useRag: true,
      isDefault: true,
      active: true,
      createdById: admin.id,
    },
  })

  console.log("✅ Seed completo.")
  console.log("")
  console.log("Cuentas demo:")
  console.log("  ADMIN  → admin@helpdesk.local / admin123")
  console.log("  AGENT  → soporte@helpdesk.local / agent123")
  console.log("  CLIENT → juan@acme.com / client123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
