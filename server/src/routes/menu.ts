import { FastifyInstance } from 'fastify';
import { prisma } from '../prismaClient';

export default async function menuRoutes(app: FastifyInstance) {
  app.get('/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string };

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return reply.status(404).send({ success: false, error: 'Store not found' });

    const categories = await prisma.category.findMany({ orderBy: { sort: 'asc' } });

    const items = await prisma.item.findMany({
      where: { storeId, isAvailable: true },
      include: { category: true },
      orderBy: [{ isBestseller: 'desc' }, { name: 'asc' }],
    });

    const menuMapRaw = categories.map((cat) => ({
      category: cat.name,
      sort: cat.sort,
      items: items
        .filter((i) => i.categoryId === cat.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: i.price.toNumber(),
          stock: i.stock,
          imageUrl: i.imageUrl,
          isBestseller: i.isBestseller,
          foodType: i.foodType,
          gstRate: i.gstRate.toNumber(),
          hsnCode: i.hsnCode,
          categoryId: i.categoryId,
          storeId: i.storeId,
        })),
    }));

    const getCategoryPriority = (name: string) => {
      const n = name.toLowerCase();
      if (n === 'most loved') return 0;
      if (n.includes('roll')) return 1;
      if (n.includes('burger')) return 2;
      if (n.includes('combo')) return 3;
      if (n.includes('beverage')) return 4;
      if (n.includes('extra')) return 5;
      return 99;
    };

    const menuMapWithoutLoved = menuMapRaw
      .filter((m) => m.items.length > 0)
      .sort((a, b) => getCategoryPriority(a.category) - getCategoryPriority(b.category));

    // Create virtual "Most loved" category as 1st
    const mostLovedItems = items
      .filter((i) => i.isBestseller)
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price.toNumber(),
        stock: i.stock,
        imageUrl: i.imageUrl,
        isBestseller: i.isBestseller,
        foodType: i.foodType,
        gstRate: i.gstRate.toNumber(),
        hsnCode: i.hsnCode,
        categoryId: i.categoryId,
        storeId: i.storeId,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    let finalMenu = menuMapWithoutLoved.map(({ sort, ...rest }) => rest);
    if (mostLovedItems.length > 0) {
      finalMenu = [{ category: 'Most loved', items: mostLovedItems } as any, ...finalMenu];
    }

    return {
      success: true,
      data: {
        store,
        menu: finalMenu,
      },
    };
  });
}
