import prisma from '../prismaClient.js';
import { createCSV } from '../utils/csvExport.js';

export const getAllBookings = async (req, res, next) => {
  try {
    const {
      status,
      consultantType,
      page = 1,
      limit = 10,
      dateFrom,
      dateTo
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (consultantType) {
      where.consultantType = consultantType;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          payment: {
            select: {
              id: true,
              razorpayPaymentId: true,
              amount: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.booking.count({ where })
    ]);

    res.json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        payment: {
          select: {
            id: true,
            razorpayPaymentId: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: 'NOT_FOUND'
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        payment: {
          select: {
            id: true,
            razorpayPaymentId: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    next(error);
  }
};

export const exportBookings = async (req, res, next) => {
  try {
    const {
      status,
      consultantType,
      dateFrom,
      dateTo
    } = req.query;

    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (consultantType) {
      where.consultantType = consultantType;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        payment: {
          select: {
            razorpayPaymentId: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Generate CSV
    const csv = createCSV(bookings);

    // Set headers for file download
    const filename = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalBookings,
      pendingBookings,
      successBookings,
      completedBookings,
      totalRevenue,
      monthlyBookings,
      categoryStats
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.count({ where: { status: 'SUCCESS' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' }
      }),
      prisma.booking.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.booking.groupBy({
        by: ['consultantType'],
        _count: { consultantType: true },
        orderBy: { _count: { consultantType: 'desc' } }
      })
    ]);

    res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        totalBookings,
        pendingBookings,
        successBookings,
        completedBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
        monthlyBookings,
        categoryStats: categoryStats.map(stat => ({
          type: stat.consultantType,
          count: stat._count.consultantType
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
